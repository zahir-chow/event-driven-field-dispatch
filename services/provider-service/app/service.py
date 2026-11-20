import json
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Provider, ProviderStatus
from app.repository import ProviderRepository
from app.schemas import (
    ProviderCreate,
    ProviderUpdate,
    ProviderResponse,
    MatchProvidersResponse,
)


def _to_response(p: Provider) -> ProviderResponse:
    skills = json.loads(p.skills) if isinstance(p.skills, str) else p.skills
    service_zip_codes = json.loads(p.service_zip_codes) if isinstance(p.service_zip_codes, str) else p.service_zip_codes
    return ProviderResponse(
        id=p.id,
        name=p.name,
        email=p.email,
        phone=p.phone,
        status=p.status,
        skills=skills or [],
        service_zip_codes=service_zip_codes or [],
        hourly_rate=p.hourly_rate,
        rating=p.rating,
        total_jobs=p.total_jobs,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


class ProviderService:
    def __init__(self, repo: ProviderRepository, db: Session):
        self.repo = repo
        self.db = db

    def create_provider(self, data: ProviderCreate) -> ProviderResponse:
        existing = self.repo.get_by_email(data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Provider with email {data.email} already exists",
            )

        provider_id = str(uuid.uuid4())
        now = datetime.utcnow()
        provider = Provider(
            id=provider_id,
            name=data.name,
            email=data.email,
            phone=data.phone,
            status=ProviderStatus.AVAILABLE,
            skills=json.dumps(data.skills),
            service_zip_codes=json.dumps(data.service_zip_codes),
            hourly_rate=data.hourly_rate,
            rating=5.0,  # default new rating
            total_jobs=0,
            created_at=now,
        )
        self.repo.create(provider)
        self.db.commit()
        return _to_response(provider)

    def get_provider(self, provider_id: str) -> ProviderResponse:
        p = self.repo.get_by_id(provider_id)
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
        return _to_response(p)

    def list_providers(self, limit: int = 100, offset: int = 0) -> List[ProviderResponse]:
        items = self.repo.list_all(limit=limit, offset=offset)
        return [_to_response(p) for p in items]

    def update_provider(self, provider_id: str, data: ProviderUpdate) -> ProviderResponse:
        p = self.repo.get_by_id(provider_id)
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

        if data.name is not None:
            p.name = data.name
        if data.phone is not None:
            p.phone = data.phone
        if data.status is not None:
            p.status = data.status
        if data.skills is not None:
            p.skills = json.dumps(data.skills)
        if data.service_zip_codes is not None:
            p.service_zip_codes = json.dumps(data.service_zip_codes)
        if data.hourly_rate is not None:
            p.hourly_rate = data.hourly_rate

        p.updated_at = datetime.utcnow()
        self.repo.update(p)
        self.db.commit()
        return _to_response(p)

    def match_providers(self, zip_code: str, required_skills: List[str]) -> MatchProvidersResponse:
        matched = self.repo.find_matching_providers(zip_code=zip_code, required_skills=required_skills)
        return MatchProvidersResponse(providers=[_to_response(p) for p in matched])

    def update_rating(self, provider_id: str, new_rating: float, increment_jobs: bool = True) -> ProviderResponse:
        p = self.repo.get_by_id(provider_id)
        if not p:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

        if increment_jobs:
            current_total = p.total_jobs
            # Running average
            p.rating = round(((p.rating * current_total) + new_rating) / (current_total + 1), 2)
            p.total_jobs += 1
        else:
            p.rating = round(new_rating, 2)

        p.updated_at = datetime.utcnow()
        self.repo.update(p)
        self.db.commit()
        return _to_response(p)
