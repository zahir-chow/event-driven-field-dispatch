from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import WorkOrderStatus


class WorkOrderCreate(BaseModel):
    client_id: str
    title: str
    description: Optional[str] = None
    zip_code: str
    required_skills: List[str]
    scheduled_at: Optional[datetime] = None
    budget: Optional[float] = None


class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[WorkOrderStatus] = None
    scheduled_at: Optional[datetime] = None
    budget: Optional[float] = None


class WorkOrderResponse(BaseModel):
    id: str
    client_id: str
    title: str
    description: Optional[str]
    status: WorkOrderStatus
    zip_code: str
    required_skills: List[str]
    scheduled_at: Optional[datetime]
    budget: Optional[float]
    version: int
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    items: List[WorkOrderResponse]
    next_cursor: Optional[str] = None  # base64-encoded "created_at,id"


class CancelWorkOrderRequest(BaseModel):
    cancelled_by: str
    reason: Optional[str] = None
