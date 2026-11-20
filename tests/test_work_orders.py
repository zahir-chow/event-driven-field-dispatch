import os
import sys
import uuid
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parent.parent
svc_path = str(ROOT_DIR / "services" / "work-order-service")

# Clean import of work-order-service
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
if svc_path in sys.path:
    sys.path.remove(svc_path)
sys.path.insert(0, svc_path)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import Base, get_db
from app.models import WorkOrder, WorkOrderStatus, IdempotencyKey
from app.main import app


def test_work_order_idempotency_and_pagination():
    """
    Tests:
      1. HTTP Idempotency-Key header on POST /api/v1/work-orders
      2. Keyset (cursor) pagination on GET /api/v1/work-orders
      3. Work order cancellation lifecycle
    """
    db_file = os.path.join(tempfile.gettempdir(), f"dizpatch_wo_{uuid.uuid4().hex[:8]}.db")
    test_engine = create_engine(f"sqlite:///{db_file}")
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    # 1. Test HTTP Idempotency Key
    idem_key = f"idem-key-{uuid.uuid4()}"
    payload = {
        "client_id": "client-100",
        "title": "Install Network Switch",
        "description": "24-port PoE Gigabit switch",
        "zip_code": "75001",
        "required_skills": ["Networking", "Switch Configuration"],
        "budget": 250.0,
    }

    # First POST
    res1 = client.post("/api/v1/work-orders", json=payload, headers={"Idempotency-Key": idem_key})
    assert res1.status_code == 201
    data1 = res1.json()
    wo_id = data1["id"]
    assert data1["title"] == payload["title"]

    # Second POST with identical Idempotency-Key
    res2 = client.post("/api/v1/work-orders", json=payload, headers={"Idempotency-Key": idem_key})
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["id"] == wo_id, "Idempotent POST must return the exact same resource ID"

    # Verify only ONE row exists in work_orders table
    db = TestingSession()
    total_wos = db.query(WorkOrder).count()
    assert total_wos == 1

    # Verify idempotency_keys table
    key_entry = db.query(IdempotencyKey).filter(IdempotencyKey.key == idem_key).first()
    assert key_entry is not None
    db.close()

    # 2. Test Keyset Cursor Pagination
    # Create 5 more work orders
    for i in range(5):
        client.post(
            "/api/v1/work-orders",
            json={
                "client_id": f"client-{i}",
                "title": f"Batch Job {i}",
                "zip_code": "75001",
                "required_skills": ["CCTV"],
            },
        )

    # Fetch page 1 (limit=3)
    p1 = client.get("/api/v1/work-orders?limit=3")
    assert p1.status_code == 200
    p1_data = p1.json()
    assert len(p1_data["items"]) == 3
    assert p1_data["next_cursor"] is not None

    # Fetch page 2 using next_cursor
    cursor = p1_data["next_cursor"]
    p2 = client.get(f"/api/v1/work-orders?limit=3&cursor={cursor}")
    assert p2.status_code == 200
    p2_data = p2.json()
    assert len(p2_data["items"]) == 3

    # Assert no overlapping IDs between page 1 and page 2
    p1_ids = {item["id"] for item in p1_data["items"]}
    p2_ids = {item["id"] for item in p2_data["items"]}
    assert p1_ids.isdisjoint(p2_ids), "Keyset pagination pages must not overlap!"

    # 3. Test Work Order Cancellation
    cancel_res = client.post(
        f"/api/v1/work-orders/{wo_id}/cancel",
        json={"cancelled_by": "client-100", "reason": "Site closed for renovation"},
    )
    assert cancel_res.status_code == 200

    # Verify status changed to CANCELLED
    get_res = client.get(f"/api/v1/work-orders/{wo_id}")
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "CANCELLED"
    assert get_res.json()["version"] == 2

    app.dependency_overrides.clear()
    try:
        os.remove(db_file)
    except Exception:
        pass
