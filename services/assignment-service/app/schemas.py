from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models import AssignmentStatus


class MatchRequest(BaseModel):
    work_order_id: str
    zip_code: str
    required_skills: List[str] = []
    strategy: str = "rating"  # 'rating', 'distance', or 'cost'


class AcceptAssignmentRequest(BaseModel):
    provider_id: str
    expected_version: Optional[int] = None


class AssignmentResponse(BaseModel):
    id: str
    work_order_id: str
    provider_id: Optional[str]
    status: AssignmentStatus
    version: int
    matched_providers: List[str]
    strategy_used: Optional[str]
    accepted_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
