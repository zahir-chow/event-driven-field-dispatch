from sqlalchemy import Column, String, Text, Integer, Float, DateTime, Enum as SAEnum, Index
from app.database import Base
from shared.outbox import make_outbox_model
from datetime import datetime
import enum


class WorkOrderStatus(str, enum.Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(String(36), primary_key=True)
    client_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(WorkOrderStatus, native_enum=False), nullable=False, default=WorkOrderStatus.OPEN)
    zip_code = Column(String(10), nullable=False)
    required_skills = Column(Text, nullable=False)  # JSON array stored as text
    scheduled_at = Column(DateTime, nullable=True)
    budget = Column(Float, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    __table_args__ = (Index("ix_work_orders_created_at_id", "created_at", "id"),)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    key = Column(String(255), primary_key=True)
    response_status = Column(Integer, nullable=False)
    response_body = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


OutboxEvent = make_outbox_model(Base)
