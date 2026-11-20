import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, Enum as SAEnum
from app.database import Base
from shared.outbox import make_outbox_model


class NotificationChannel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    PUSH = "PUSH"


class NotificationStatus(str, enum.Enum):
    SENT = "SENT"
    FAILED = "FAILED"


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String(36), primary_key=True)
    event_id = Column(String(36), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    recipient = Column(String(255), nullable=False)
    channel = Column(SAEnum(NotificationChannel, native_enum=False), nullable=False)
    subject = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(SAEnum(NotificationStatus, native_enum=False), nullable=False, default=NotificationStatus.SENT)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id = Column(String(36), primary_key=True)
    aggregate_id = Column(String(36), nullable=True, index=True)
    version = Column(Integer, nullable=False, default=1)
    processed_at = Column(DateTime, nullable=False, default=datetime.utcnow)


OutboxEvent = make_outbox_model(Base)
