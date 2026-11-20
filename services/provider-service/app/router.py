from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repository import ProviderRepository
from app.service import ProviderService
from app.schemas import (
    ProviderCreate,
    ProviderUpdate,
    ProviderResponse,
    MatchProvidersRequest,
    MatchProvidersResponse,
    RatingUpdateRequest,
)

router = APIRouter(prefix="/api/v1/providers", tags=["providers"])


def get_service(db: Session = Depends(get_db)) -> ProviderService:
    repo = ProviderRepository(db)
    return ProviderService(repo, db)


@router.post(
    "",
    response_model=ProviderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new provider",
)
def create_provider(
    payload: ProviderCreate,
    service: ProviderService = Depends(get_service),
):
    return service.create_provider(payload)


@router.get(
    "",
    response_model=List[ProviderResponse],
    summary="List providers",
)
def list_providers(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: ProviderService = Depends(get_service),
):
    return service.list_providers(limit=limit, offset=offset)


@router.post(
    "/match",
    response_model=MatchProvidersResponse,
    summary="Find eligible providers by zip code and skills",
)
def match_providers(
    payload: MatchProvidersRequest,
    service: ProviderService = Depends(get_service),
):
    return service.match_providers(zip_code=payload.zip_code, required_skills=payload.required_skills)


@router.get(
    "/{provider_id}",
    response_model=ProviderResponse,
    summary="Get provider by ID",
)
def get_provider(
    provider_id: str,
    service: ProviderService = Depends(get_service),
):
    return service.get_provider(provider_id)


@router.patch(
    "/{provider_id}",
    response_model=ProviderResponse,
    summary="Update provider details",
)
def update_provider(
    provider_id: str,
    payload: ProviderUpdate,
    service: ProviderService = Depends(get_service),
):
    return service.update_provider(provider_id, payload)


@router.post(
    "/{provider_id}/rating",
    response_model=ProviderResponse,
    summary="Update provider rating",
)
def update_provider_rating(
    provider_id: str,
    payload: RatingUpdateRequest,
    service: ProviderService = Depends(get_service),
):
    return service.update_rating(
        provider_id=provider_id,
        new_rating=payload.rating,
        increment_jobs=payload.increment_jobs,
    )
