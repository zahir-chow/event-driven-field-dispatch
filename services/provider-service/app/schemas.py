from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models import ProviderStatus


class ProviderCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    skills: List[str] = []
    service_zip_codes: List[str] = []
    hourly_rate: Optional[float] = None


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[ProviderStatus] = None
    skills: Optional[List[str]] = None
    service_zip_codes: Optional[List[str]] = None
    hourly_rate: Optional[float] = None


class ProviderResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str]
    status: ProviderStatus
    skills: List[str]
    service_zip_codes: List[str]
    hourly_rate: Optional[float]
    rating: float
    total_jobs: int
    created_at: datetime
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


class MatchProvidersRequest(BaseModel):
    zip_code: str
    required_skills: List[str]


class MatchProvidersResponse(BaseModel):
    providers: List[ProviderResponse]


class RatingUpdateRequest(BaseModel):
    rating: float
    increment_jobs: bool = True
