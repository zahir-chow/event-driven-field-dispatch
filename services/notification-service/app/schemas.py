from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.models import NotificationChannel, NotificationStatus


class NotificationCreateRequest(BaseModel):
    recipient: str
    channel: NotificationChannel
    subject: Optional[str] = None
    message: str


class NotificationLogResponse(BaseModel):
    id: str
    event_id: str
    event_type: str
    recipient: str
    channel: NotificationChannel
    subject: Optional[str]
    message: str
    status: NotificationStatus
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}
