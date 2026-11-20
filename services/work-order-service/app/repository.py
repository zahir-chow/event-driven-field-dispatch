from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import WorkOrder, IdempotencyKey, OutboxEvent


class WorkOrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, work_order_id: str) -> Optional[WorkOrder]:
        return self.db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()

    def list_paginated(
        self,
        cursor_ts: Optional[datetime] = None,
        cursor_id: Optional[str] = None,
        limit: int = 20,
    ) -> List[WorkOrder]:
        query = self.db.query(WorkOrder)
        if cursor_ts is not None and cursor_id is not None:
            # Keyset pagination: items created before cursor_ts, or at the same
            # timestamp but with a lexicographically smaller id.
            query = query.filter(
                (WorkOrder.created_at < cursor_ts)
                | (
                    (WorkOrder.created_at == cursor_ts)
                    & (WorkOrder.id < cursor_id)
                )
            )
        query = query.order_by(WorkOrder.created_at.desc(), WorkOrder.id.desc())
        return query.limit(limit).all()

    def create(self, work_order: WorkOrder) -> WorkOrder:
        self.db.add(work_order)
        self.db.flush()
        self.db.refresh(work_order)
        return work_order

    def update(self, work_order: WorkOrder) -> WorkOrder:
        self.db.add(work_order)
        self.db.flush()
        self.db.refresh(work_order)
        return work_order

    def create_outbox_event(self, event: OutboxEvent) -> OutboxEvent:
        self.db.add(event)
        self.db.flush()
        return event


class IdempotencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str) -> Optional[IdempotencyKey]:
        return self.db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()

    def save(self, key: str, status: int, body: str) -> IdempotencyKey:
        idem = IdempotencyKey(
            key=key,
            response_status=status,
            response_body=body,
            created_at=datetime.utcnow(),
        )
        self.db.add(idem)
        self.db.flush()
        return idem
