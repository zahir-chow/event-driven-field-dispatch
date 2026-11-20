from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import NotificationLog, ProcessedEvent


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, log_id: str) -> Optional[NotificationLog]:
        return self.db.query(NotificationLog).filter(NotificationLog.id == log_id).first()

    def list_logs(self, limit: int = 100, offset: int = 0) -> List[NotificationLog]:
        return (
            self.db.query(NotificationLog)
            .order_by(NotificationLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def list_by_event_id(self, event_id: str) -> List[NotificationLog]:
        return self.db.query(NotificationLog).filter(NotificationLog.event_id == event_id).all()

    def create_log(self, log: NotificationLog) -> NotificationLog:
        self.db.add(log)
        self.db.flush()
        return log

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
