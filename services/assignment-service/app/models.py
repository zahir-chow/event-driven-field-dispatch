import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, Enum as SAEnum, UniqueConstraint
from app.database import Base
from shared.outbox import make_outbox_model


class AssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String(36), primary_key=True)
    # Hard database unique constraint prevents TOCTOU race conditions
    work_order_id = Column(String(36), unique=True, nullable=False, index=True)
    provider_id = Column(String(36), nullable=True, index=True)
    status = Column(SAEnum(AssignmentStatus, native_enum=False), nullable=False, default=AssignmentStatus.PENDING)
    # Optimistic locking version column
    version = Column(Integer, nullable=False, default=1)
    matched_providers = Column(Text, nullable=False, default="[]")
    strategy_used = Column(String(50), nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id = Column(String(36), primary_key=True)
    aggregate_id = Column(String(36), nullable=True, index=True)
    version = Column(Integer, nullable=False, default=1)
    processed_at = Column(DateTime, nullable=False, default=datetime.utcnow)


OutboxEvent = make_outbox_model(Base)
