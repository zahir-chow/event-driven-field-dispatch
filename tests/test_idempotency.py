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


def test_idempotent_event_replay():
    """
    Test 2: Idempotent Event Consumption
    Replays the exact same AssignmentAccepted Kafka event twice.
    Asserts:
      - Only one notification record set is created in the database.
      - The second delivery safely no-ops without duplicate entries or errors.
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

    event_id = str(uuid.uuid4())
    work_order_id = str(uuid.uuid4())
    provider_id = "provider-alpha-42"

    assignment_accepted_event = {
        "event_id": event_id,
        "event_type": "AssignmentAccepted",
        "aggregate_type": "work_order",
        "aggregate_id": work_order_id,
        "version": 2,
        "trace_id": "test-trace-idempotency",
        "payload": {
            "work_order_id": work_order_id,
            "assignment_id": str(uuid.uuid4()),
            "provider_id": provider_id,
            "accepted_at": "2026-11-19T10:00:00Z",
        },
    }

    # 1. First event processing
    res1 = service.process_domain_event(assignment_accepted_event)
    assert res1 is True

    # Check notification logs after first processing
    first_logs = db.query(NotificationLog).filter(NotificationLog.event_id == event_id).all()
    first_count = len(first_logs)
    assert first_count > 0, "Expected at least 1 notification record from first processing"

    # Verify event recorded in processed_events table
    pe = repo.get_processed_event(event_id)
    assert pe is not None
    assert pe.event_id == event_id

    # 2. Second event processing (replaying exact same event)
    res2 = service.process_domain_event(assignment_accepted_event)
    assert res2 is True

    # Verify count did NOT increase
    subsequent_logs = db.query(NotificationLog).filter(NotificationLog.event_id == event_id).all()
    assert len(subsequent_logs) == first_count, (
        f"Idempotency violation! Expected {first_count} notification logs, found {len(subsequent_logs)}"
    )

    db.close()
