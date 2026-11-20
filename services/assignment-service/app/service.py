import os
import json
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Assignment, AssignmentStatus, OutboxEvent
from app.repository import AssignmentRepository, OptimisticLockError, DuplicateAssignmentError
from app.schemas import AssignmentResponse, MatchRequest
from app.strategies import get_ranking_strategy
from shared.outbox import OutboxStatus

PROVIDER_SERVICE_URL = os.environ.get("PROVIDER_SERVICE_URL", "http://localhost:8002")


def _to_response(a: Assignment) -> AssignmentResponse:
    try:
        matched = json.loads(a.matched_providers) if isinstance(a.matched_providers, str) else a.matched_providers
    except Exception:
        matched = []

    return AssignmentResponse(
        id=a.id,
        work_order_id=a.work_order_id,
        provider_id=a.provider_id,
        status=a.status,
        version=a.version,
        matched_providers=matched or [],
        strategy_used=a.strategy_used,
        accepted_at=a.accepted_at,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


class AssignmentService:
    def __init__(self, repo: AssignmentRepository, db: Session):
        self.repo = repo
        self.db = db

    def get_assignment_by_work_order(self, work_order_id: str) -> AssignmentResponse:
        a = self.repo.get_by_work_order_id(work_order_id)
        if not a:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found for work order")
        return _to_response(a)

    def match_and_create_assignment(
        self,
        work_order_id: str,
        zip_code: str,
        required_skills: List[str],
        strategy_name: str = "rating",
        trace_id: Optional[str] = None,
    ) -> AssignmentResponse:
        # Check if assignment already exists
        existing = self.repo.get_by_work_order_id(work_order_id)
        if existing:
            return _to_response(existing)

        # 1. Query provider-service for eligible providers
        providers_data = []
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(
                    f"{PROVIDER_SERVICE_URL}/api/v1/providers/match",
                    json={"zip_code": zip_code, "required_skills": required_skills},
                    headers={"X-Correlation-ID": trace_id} if trace_id else None,
                )
                if resp.status_code == 200:
                    providers_data = resp.json().get("providers", [])
        except Exception:
            providers_data = []

        # 2. Rank using Strategy Pattern
        strategy = get_ranking_strategy(strategy_name)
        ranked = strategy.rank(providers_data, context={"zip_code": zip_code, "skills": required_skills})
        matched_ids = [p["id"] for p in ranked]

        # 3. Create Assignment record
        assignment_id = str(uuid.uuid4())
        now = datetime.utcnow()
        assignment = Assignment(
            id=assignment_id,
            work_order_id=work_order_id,
            provider_id=None,
            status=AssignmentStatus.PENDING,
            version=1,
            matched_providers=json.dumps(matched_ids),
            strategy_used=strategy_name,
            created_at=now,
        )

        try:
            self.repo.create(assignment)
        except DuplicateAssignmentError:
            self.db.rollback()
            existing = self.repo.get_by_work_order_id(work_order_id)
            if existing:
                return _to_response(existing)
            raise HTTPException(status_code=409, detail="Assignment already exists for this work order")

        # 4. Insert OutboxEvent (ProvidersMatched) in SAME ACID transaction
        outbox_payload = {
            "work_order_id": work_order_id,
            "assignment_id": assignment_id,
            "matched_provider_ids": matched_ids,
            "strategy_used": strategy_name,
        }
        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            aggregate_type="work_order",
            aggregate_id=work_order_id,
            event_type="ProvidersMatched",
            payload=json.dumps(outbox_payload),
            version=1,
            trace_id=trace_id,
            status=OutboxStatus.PENDING,
            created_at=now,
        )
        self.repo.create_outbox_event(outbox_event)

        # 5. Commit
        self.db.commit()
        return _to_response(assignment)

    def accept_assignment(
        self,
        work_order_id: str,
        provider_id: str,
        expected_version: Optional[int] = None,
        trace_id: Optional[str] = None,
    ) -> AssignmentResponse:
        """
        Accept an assignment for a technician.
        Guarantees concurrency protection against TOCTOU race condition:
        Uses optimistic locking (version column) AND checks status == PENDING.
        Returns 409 Conflict if another worker accepted first.
        """
        assignment = self.repo.get_by_work_order_id(work_order_id)
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No assignment found for work order {work_order_id}",
            )

        # Fast rejection if already accepted
        if assignment.status == AssignmentStatus.ACCEPTED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Work order {work_order_id} has already been accepted by provider {assignment.provider_id}",
            )

        if assignment.status == AssignmentStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Work order {work_order_id} has been cancelled",
            )

        ver = expected_version if expected_version is not None else assignment.version

        try:
            updated = self.repo.accept_assignment(
                assignment_id=assignment.id,
                provider_id=provider_id,
                expected_version=ver,
            )
        except OptimisticLockError as ole:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(ole),
            )
        except IntegrityError as ie:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unique constraint violation: work order already assigned",
            )

        now = datetime.utcnow()
        # Insert OutboxEvent (AssignmentAccepted) in SAME transaction
        outbox_payload = {
            "work_order_id": work_order_id,
            "assignment_id": updated.id,
            "provider_id": provider_id,
            "accepted_at": updated.accepted_at.isoformat() if updated.accepted_at else now.isoformat(),
        }
        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            aggregate_type="work_order",
            aggregate_id=work_order_id,
            event_type="AssignmentAccepted",
            payload=json.dumps(outbox_payload),
            version=updated.version,
            trace_id=trace_id,
            status=OutboxStatus.PENDING,
            created_at=now,
        )
        self.repo.create_outbox_event(outbox_event)

        # Commit transaction
        self.db.commit()
        return _to_response(updated)
