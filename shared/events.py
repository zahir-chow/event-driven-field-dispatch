from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime
import uuid


class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    aggregate_type: str
    aggregate_id: str
    version: int
    trace_id: Optional[str] = None
    payload: Dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WorkOrderCreatedPayload(BaseModel):
    work_order_id: str
    client_id: str
    title: str
    description: str
    zip_code: str
    required_skills: List[str]
    scheduled_at: Optional[str] = None
    budget: Optional[float] = None


class ProvidersMatchedPayload(BaseModel):
    work_order_id: str
    matched_provider_ids: List[str]
    strategy_used: str


class AssignmentAcceptedPayload(BaseModel):
    work_order_id: str
    assignment_id: str
    provider_id: str
    accepted_at: str


class WorkOrderCancelledPayload(BaseModel):
    work_order_id: str
    cancelled_by: str
    reason: Optional[str] = None
