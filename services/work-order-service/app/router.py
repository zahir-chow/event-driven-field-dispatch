from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repository import WorkOrderRepository, IdempotencyRepository
from app.service import WorkOrderService
from app.schemas import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse,
    CancelWorkOrderRequest,
)

router = APIRouter(prefix="/api/v1/work-orders", tags=["work-orders"])


def get_service(db: Session = Depends(get_db)) -> WorkOrderService:
    wo_repo = WorkOrderRepository(db)
    idem_repo = IdempotencyRepository(db)
    return WorkOrderService(wo_repo, idem_repo, db)


@router.post(
    "",
    response_model=WorkOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new work order",
)
def create_work_order(
    payload: WorkOrderCreate,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    service: WorkOrderService = Depends(get_service),
):
    trace_id = getattr(request.state, "correlation_id", None)
    return service.create_work_order(payload, idempotency_key=idempotency_key, trace_id=trace_id)


@router.get(
    "",
    response_model=WorkOrderListResponse,
    summary="List work orders with keyset pagination",
)
def list_work_orders(
    cursor: Optional[str] = Query(None, description="Base64 encoded cursor (created_at,id)"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    service: WorkOrderService = Depends(get_service),
):
    return service.list_work_orders(cursor=cursor, limit=limit)


@router.get(
    "/{work_order_id}",
    response_model=WorkOrderResponse,
    summary="Get work order by ID",
)
def get_work_order(
    work_order_id: str,
    service: WorkOrderService = Depends(get_service),
):
    return service.get_work_order(work_order_id)


@router.patch(
    "/{work_order_id}",
    response_model=WorkOrderResponse,
    summary="Update a work order",
)
def update_work_order(
    work_order_id: str,
    payload: WorkOrderUpdate,
    service: WorkOrderService = Depends(get_service),
):
    return service.update_work_order(work_order_id, payload)


@router.post(
    "/{work_order_id}/cancel",
    status_code=status.HTTP_200_OK,
    summary="Cancel a work order",
)
def cancel_work_order(
    work_order_id: str,
    payload: CancelWorkOrderRequest,
    request: Request,
    service: WorkOrderService = Depends(get_service),
):
    trace_id = getattr(request.state, "correlation_id", None)
    service.cancel_work_order(
        work_order_id=work_order_id,
        cancelled_by=payload.cancelled_by,
        reason=payload.reason,
        trace_id=trace_id,
    )
    return {"status": "cancelled", "work_order_id": work_order_id}


@router.delete(
    "/{work_order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete/cancel a work order",
)
def delete_work_order(
    work_order_id: str,
    request: Request,
    service: WorkOrderService = Depends(get_service),
):
    trace_id = getattr(request.state, "correlation_id", None)
    service.cancel_work_order(
        work_order_id=work_order_id,
        cancelled_by="system",
        reason="HTTP DELETE request",
        trace_id=trace_id,
    )
    return None
