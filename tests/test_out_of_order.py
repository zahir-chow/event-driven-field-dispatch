import os
import sys
import uuid
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT_DIR = Path(__file__).resolve().parent.parent
svc_path = str(ROOT_DIR / "services" / "notification-service")

# Ensure clean import of notification-service
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
if svc_path in sys.path:
    sys.path.remove(svc_path)
sys.path.insert(0, svc_path)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import Base
from app.models import NotificationLog, ProcessedEvent
from app.repository import NotificationRepository
from app.service import NotificationService


def test_out_of_order_event_version_discard():
    """
    Test 3: Out-of-Order Event Protection
    Sends WorkOrderCancelled (v3) first, then sends WorkOrderUpdated (v2) out of order.
    Asserts:
      - v3 is accepted and processed.
      - v2 is recognized as stale (v2 <= v3) and discarded.
      - Cancelled status/notification is preserved without being overwritten by stale v2.
    """
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    db = TestingSession()
    repo = NotificationRepository(db)
    service = NotificationService(repo, db)

    work_order_id = str(uuid.uuid4())
    v3_event_id = str(uuid.uuid4())
    v2_event_id = str(uuid.uuid4())

    # Step 1: WorkOrderCancelled (v3) arrives first
    cancelled_v3_event = {
        "event_id": v3_event_id,
        "event_type": "WorkOrderCancelled",
        "aggregate_type": "work_order",
        "aggregate_id": work_order_id,
        "version": 3,
        "payload": {
            "work_order_id": work_order_id,
            "cancelled_by": "client-user-1",
            "reason": "Client cancelled project",
        },
    }

    res_v3 = service.process_domain_event(cancelled_v3_event)
    assert res_v3 is True

    # Verify v3 logs
    v3_logs = db.query(NotificationLog).filter(NotificationLog.event_id == v3_event_id).all()
    assert len(v3_logs) == 1
    assert "Cancelled" in v3_logs[0].subject
    assert v3_logs[0].version == 3

    # Verify highest recorded version is 3
    assert repo.get_max_processed_version(work_order_id) == 3

    # Step 2: Out-of-order WorkOrderUpdated (v2) arrives late
    stale_v2_event = {
        "event_id": v2_event_id,
        "event_type": "WorkOrderCreated",  # Any update event
        "aggregate_type": "work_order",
        "aggregate_id": work_order_id,
        "version": 2,  # Stale version!
        "payload": {
            "work_order_id": work_order_id,
            "title": "Stale update that was delayed in Kafka network",
        },
    }

    res_v2 = service.process_domain_event(stale_v2_event)
    assert res_v2 is True

    # Verify that NO new notifications were dispatched for the stale v2 event
    v2_logs = db.query(NotificationLog).filter(NotificationLog.event_id == v2_event_id).all()
    assert len(v2_logs) == 0, "Stale out-of-order event must not generate notification records!"

    # Verify that max version remains 3
    assert repo.get_max_processed_version(work_order_id) == 3

    db.close()
