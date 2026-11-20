import json
import uuid
import base64
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import WorkOrder, WorkOrderStatus, OutboxEvent
from shared.outbox import OutboxStatus
from app.repository import WorkOrderRepository, IdempotencyRepository
from app.schemas import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse,
)


def _work_order_to_response(wo: WorkOrder) -> WorkOrderResponse:
    return WorkOrderResponse(
        id=wo.id,
        client_id=wo.client_id,
        title=wo.title,
        description=wo.description,
        status=wo.status,
        zip_code=wo.zip_code,
        required_skills=json.loads(wo.required_skills),
        scheduled_at=wo.scheduled_at,
        budget=wo.budget,
        version=wo.version,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )


class WorkOrderService:
    def __init__(
        self,
        wo_repo: WorkOrderRepository,
        idem_repo: IdempotencyRepository,
        db: Session,
    ):
        self.wo_repo = wo_repo
        self.idem_repo = idem_repo
        self.db = db

    def create_work_order(
        self,
        data: WorkOrderCreate,
        idempotency_key: Optional[str],
        trace_id: Optional[str],
    ) -> WorkOrderResponse:
        # 1. Idempotency check
        if idempotency_key:
            existing = self.idem_repo.get(idempotency_key)
            if existing:
                return WorkOrderResponse(**json.loads(existing.response_body))

        # 2. Build WorkOrder model
        work_order_id = str(uuid.uuid4())
        now = datetime.utcnow()
        wo = WorkOrder(
            id=work_order_id,
            client_id=data.client_id,
            title=data.title,
            description=data.description,
            status=WorkOrderStatus.OPEN,
            zip_code=data.zip_code,
            required_skills=json.dumps(data.required_skills),
            scheduled_at=data.scheduled_at,
            budget=data.budget,
            version=1,
            created_at=now,
        )

        # 3. Persist work order
        self.wo_repo.create(wo)

        # Build response dict for idempotency storage
        response = _work_order_to_response(wo)
        response_dict = response.model_dump(mode="json")

        # 4. Save idempotency key (same transaction)
        if idempotency_key:
            self.idem_repo.save(
                key=idempotency_key,
                status=201,
                body=json.dumps(response_dict),
            )

        # 5. Insert outbox event
        payload = {
            "work_order_id": work_order_id,
            "client_id": data.client_id,
            "title": data.title,
            "description": data.description,
            "zip_code": data.zip_code,
            "required_skills": data.required_skills,
            "scheduled_at": data.scheduled_at.isoformat() if data.scheduled_at else None,
            "budget": data.budget,
        }
        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            aggregate_type="work_order",
            aggregate_id=work_order_id,
            event_type="WorkOrderCreated",
            payload=json.dumps(payload),
            version=1,
            trace_id=trace_id,
            status=OutboxStatus.PENDING,
            created_at=now,
        )
        self.wo_repo.create_outbox_event(outbox_event)

        # 6. Commit
        self.db.commit()

        return response

    def get_work_order(self, work_order_id: str) -> WorkOrderResponse:
        wo = self.wo_repo.get_by_id(work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")
        return _work_order_to_response(wo)

    def list_work_orders(
        self, cursor: Optional[str], limit: int
    ) -> WorkOrderListResponse:
        cursor_ts: Optional[datetime] = None
        cursor_id: Optional[str] = None

        if cursor:
            try:
                decoded = base64.b64decode(cursor.encode()).decode()
                ts_str, cid = decoded.split(",", 1)
                cursor_ts = datetime.fromisoformat(ts_str)
                cursor_id = cid
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid cursor")

        items = self.wo_repo.list_paginated(
            cursor_ts=cursor_ts, cursor_id=cursor_id, limit=limit
        )
        responses = [_work_order_to_response(wo) for wo in items]

        next_cursor: Optional[str] = None
        if len(items) == limit:
            last = items[-1]
            raw = f"{last.created_at.isoformat()},{last.id}"
            next_cursor = base64.b64encode(raw.encode()).decode()

        return WorkOrderListResponse(items=responses, next_cursor=next_cursor)

    def update_work_order(
        self, work_order_id: str, data: WorkOrderUpdate
    ) -> WorkOrderResponse:
        wo = self.wo_repo.get_by_id(work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")

        if data.title is not None:
            wo.title = data.title
        if data.description is not None:
            wo.description = data.description
        if data.status is not None:
            wo.status = data.status
        if data.scheduled_at is not None:
            wo.scheduled_at = data.scheduled_at
        if data.budget is not None:
            wo.budget = data.budget

        wo.version += 1
        wo.updated_at = datetime.utcnow()

        self.wo_repo.update(wo)
        self.db.commit()

        return _work_order_to_response(wo)

    def cancel_work_order(
        self,
        work_order_id: str,
        cancelled_by: str,
        reason: Optional[str],
        trace_id: Optional[str],
    ) -> None:
        wo = self.wo_repo.get_by_id(work_order_id)
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")
        if wo.status == WorkOrderStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Work order already cancelled")

        wo.status = WorkOrderStatus.CANCELLED
        wo.version += 1
        wo.updated_at = datetime.utcnow()

        self.wo_repo.update(wo)

        now = datetime.utcnow()
        payload = {
            "work_order_id": work_order_id,
            "cancelled_by": cancelled_by,
            "reason": reason,
        }
        outbox_event = OutboxEvent(
            event_id=str(uuid.uuid4()),
            aggregate_type="work_order",
            aggregate_id=work_order_id,
            event_type="WorkOrderCancelled",
            payload=json.dumps(payload),
            version=wo.version,
            trace_id=trace_id,
            status=OutboxStatus.PENDING,
            created_at=now,
        )
        self.wo_repo.create_outbox_event(outbox_event)

        self.db.commit()
