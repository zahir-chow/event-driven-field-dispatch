from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text, update
from sqlalchemy.exc import IntegrityError
from app.models import Assignment, AssignmentStatus, ProcessedEvent, OutboxEvent


class OptimisticLockError(Exception):
    """Raised when an update fails due to version mismatch or state transition conflict."""
    pass


class DuplicateAssignmentError(Exception):
    """Raised when an assignment for this work_order_id already exists."""
    pass


class AssignmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, assignment_id: str) -> Optional[Assignment]:
        return self.db.query(Assignment).filter(Assignment.id == assignment_id).first()

    def get_by_work_order_id(self, work_order_id: str) -> Optional[Assignment]:
        return self.db.query(Assignment).filter(Assignment.work_order_id == work_order_id).first()

    def create(self, assignment: Assignment) -> Assignment:
        try:
            self.db.add(assignment)
            self.db.flush()
            self.db.refresh(assignment)
            return assignment
        except IntegrityError as exc:
            self.db.rollback()
            raise DuplicateAssignmentError(f"Assignment for work order {assignment.work_order_id} already exists") from exc

    def accept_assignment(
        self,
        assignment_id: str,
        provider_id: str,
        expected_version: int,
    ) -> Assignment:
        """
        Executes atomic optimistic-locking update.
        Guarantees that only the request with matching expected_version and PENDING status succeeds.
        """
        now = datetime.utcnow()
        stmt = (
            update(Assignment)
            .where(
                Assignment.id == assignment_id,
                Assignment.status == AssignmentStatus.PENDING,
                Assignment.version == expected_version,
            )
            .values(
                status=AssignmentStatus.ACCEPTED,
                provider_id=provider_id,
                version=Assignment.version + 1,
                accepted_at=now,
                updated_at=now,
            )
        )
        result = self.db.execute(stmt)
        if result.rowcount == 0:
            raise OptimisticLockError(
                f"Conflict: Assignment {assignment_id} has already been accepted, cancelled, or modified (expected version {expected_version})"
            )

        self.db.flush()
        # Retrieve updated assignment
        updated = self.get_by_id(assignment_id)
        return updated

    def create_outbox_event(self, event: OutboxEvent) -> OutboxEvent:
        self.db.add(event)
        self.db.flush()
        return event

    def get_processed_event(self, event_id: str) -> Optional[ProcessedEvent]:
        return self.db.query(ProcessedEvent).filter(ProcessedEvent.event_id == event_id).first()

    def get_max_processed_version(self, aggregate_id: str) -> int:
        records = (
            self.db.query(ProcessedEvent.version)
            .filter(ProcessedEvent.aggregate_id == aggregate_id)
            .order_by(ProcessedEvent.version.desc())
            .first()
        )
        return records[0] if records else 0

    def record_processed_event(self, event_id: str, aggregate_id: str, version: int) -> ProcessedEvent:
        pe = ProcessedEvent(
            event_id=event_id,
            aggregate_id=aggregate_id,
            version=version,
            processed_at=datetime.utcnow(),
        )
        self.db.add(pe)
        self.db.flush()
        return pe
