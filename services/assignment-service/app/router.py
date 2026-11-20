from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repository import AssignmentRepository
from app.service import AssignmentService
from app.schemas import (
    MatchRequest,
    AcceptAssignmentRequest,
    AssignmentResponse,
)

router = APIRouter(prefix="/api/v1/assignments", tags=["assignments"])


def get_service(db: Session = Depends(get_db)) -> AssignmentService:
    repo = AssignmentRepository(db)
    return AssignmentService(repo, db)


@router.post(
    "/match",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Match providers to a work order using ranking strategy",
)
def match_assignment(
    payload: MatchRequest,
    request: Request,
    service: AssignmentService = Depends(get_service),
):
    trace_id = getattr(request.state, "correlation_id", None)
    return service.match_and_create_assignment(
        work_order_id=payload.work_order_id,
        zip_code=payload.zip_code,
        required_skills=payload.required_skills,
        strategy_name=payload.strategy,
        trace_id=trace_id,
    )


@router.post(
    "/{work_order_id}/accept",
    response_model=AssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Technician accepts work order (Optimistic locking & TOCTOU protection)",
)
def accept_assignment(
    work_order_id: str,
    payload: AcceptAssignmentRequest,
    request: Request,
    service: AssignmentService = Depends(get_service),
):
    trace_id = getattr(request.state, "correlation_id", None)
    return service.accept_assignment(
        work_order_id=work_order_id,
        provider_id=payload.provider_id,
        expected_version=payload.expected_version,
        trace_id=trace_id,
    )


@router.get(
    "/{work_order_id}",
    response_model=AssignmentResponse,
    summary="Get assignment details by work order ID",
)
def get_assignment(
    work_order_id: str,
    service: AssignmentService = Depends(get_service),
):
    return service.get_assignment_by_work_order(work_order_id)
