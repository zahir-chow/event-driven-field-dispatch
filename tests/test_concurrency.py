import os
import sys
import uuid
import json
import tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT_DIR = Path(__file__).resolve().parent.parent
svc_path = str(ROOT_DIR / "services" / "assignment-service")

# Ensure clean import of assignment-service
for k in list(sys.modules.keys()):
    if k == "app" or k.startswith("app."):
        del sys.modules[k]
if svc_path in sys.path:
    sys.path.remove(svc_path)
sys.path.insert(0, svc_path)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import Base, get_db
from app.models import Assignment, AssignmentStatus
from app.main import app


def test_concurrency_double_assignment_prevention():
    """
    Test 1: Concurrency Protection (TOCTOU & Optimistic Locking)
    Fires 10 simultaneous POST /api/v1/assignments/{work_order_id}/accept requests
    for the exact same work_order_id.
    
    Asserts:
      - Exactly 1 request succeeds with 200 OK
      - Exactly 9 requests fail with 409 Conflict
      - The final database state records only ONE assigned provider
    """
    db_file = os.path.join(tempfile.gettempdir(), f"dizpatch_conc_{uuid.uuid4().hex[:8]}.db")
    test_engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"timeout": 30},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    work_order_id = str(uuid.uuid4())
    assignment_id = str(uuid.uuid4())
    candidate_provider_ids = [f"provider-tech-{i}" for i in range(1, 11)]

    # Pre-populate assignment in PENDING state
    db = TestingSessionLocal()
    assignment = Assignment(
        id=assignment_id,
        work_order_id=work_order_id,
        provider_id=None,
        status=AssignmentStatus.PENDING,
        version=1,
        matched_providers=json.dumps(candidate_provider_ids),
        strategy_used="rating",
    )
    db.add(assignment)
    db.commit()
    db.close()

    def fire_accept_request(tech_id: str):
        return client.post(
            f"/api/v1/assignments/{work_order_id}/accept",
            json={"provider_id": tech_id, "expected_version": 1},
        )

    responses = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fire_accept_request, pid) for pid in candidate_provider_ids]
        for f in as_completed(futures):
            responses.append(f.result())

    status_codes = [r.status_code for r in responses]
    success_count = status_codes.count(200)
    conflict_count = status_codes.count(409)

    print(f"\nConcurrency Test Results: 200 OK = {success_count}, 409 Conflict = {conflict_count}")

    assert success_count == 1, f"Expected exactly 1 success (200), got {success_count}"
    assert conflict_count == 9, f"Expected exactly 9 conflicts (409), got {conflict_count}"

    # Verify final assignment in database
    db = TestingSessionLocal()
    final_assignment = db.query(Assignment).filter(Assignment.work_order_id == work_order_id).first()
    assert final_assignment.status == AssignmentStatus.ACCEPTED
    assert final_assignment.provider_id is not None
    assert final_assignment.provider_id in candidate_provider_ids
    assert final_assignment.version == 2
    db.close()

    app.dependency_overrides.clear()
    try:
        os.remove(db_file)
    except Exception:
        pass
