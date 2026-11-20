"""
DiZpatch Data Seeding Script
Populates sample providers, work orders, matches them, and triggers acceptance
so all 4 databases (work-orders, providers, assignments, notifications) receive dummy data.
"""
import os
import sys
import time
import uuid
import socket
import subprocess
import httpx


def _resolve_host() -> str:
    if os.environ.get("DIZPATCH_HOST"):
        return os.environ["DIZPATCH_HOST"]

    # 1. Quick probe localhost
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect(("127.0.0.1", 8001))
        s.close()
        return "127.0.0.1"
    except Exception:
        pass

    # 2. If on Windows with Podman machine in WSL2
    if sys.platform == "win32":
        for distro in ["podman-machine-default", "podman-machine-default-arm64"]:
            try:
                out = subprocess.check_output(
                    ["wsl", "-d", distro, "-u", "root", "ip", "-4", "addr", "show", "eth0"],
                    text=True, timeout=2, stderr=subprocess.DEVNULL
                )
                for line in out.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 2 and parts[0] == "inet":
                        return parts[1].split("/")[0]
            except Exception:
                continue

    return "localhost"


HOST = _resolve_host()
WORK_ORDER_URL = os.environ.get("WORK_ORDER_SERVICE_URL", f"http://{HOST}:8001")
PROVIDER_URL = os.environ.get("PROVIDER_SERVICE_URL", f"http://{HOST}:8002")
ASSIGNMENT_URL = os.environ.get("ASSIGNMENT_SERVICE_URL", f"http://{HOST}:8003")
NOTIFICATION_URL = os.environ.get("NOTIFICATION_SERVICE_URL", f"http://{HOST}:8004")

SAMPLE_PROVIDERS = [
    {
        "name": "Alex Mercer",
        "email": "alex.mercer@fieldtech.com",
        "phone": "+1-555-0101",
        "skills": ["CCTV", "Networking", "Fiber Optic", "POS"],
        "service_zip_codes": ["75001", "75002", "75006", "75201"],
        "hourly_rate": 65.0,
    },
    {
        "name": "Sarah Connor",
        "email": "sarah.connor@cybertech.org",
        "phone": "+1-555-0102",
        "skills": ["Hardware Repair", "Networking", "Server Racks"],
        "service_zip_codes": ["75001", "75003", "75201", "75202"],
        "hourly_rate": 80.0,
    },
    {
        "name": "Marcus Vance",
        "email": "marcus.vance@telecompros.net",
        "phone": "+1-555-0103",
        "skills": ["POS", "Low Voltage Cabling", "Digital Signage"],
        "service_zip_codes": ["75006", "75007", "75201"],
        "hourly_rate": 55.0,
    },
    {
        "name": "Elena Rostova",
        "email": "elena.r@datacabling.io",
        "phone": "+1-555-0104",
        "skills": ["CCTV", "Access Control", "Security Alarms"],
        "service_zip_codes": ["75001", "75002", "75006"],
        "hourly_rate": 72.5,
    },
    {
        "name": "David Kim",
        "email": "david.kim@networkspec.com",
        "phone": "+1-555-0105",
        "skills": ["Fiber Optic", "Server Racks", "Telecom"],
        "service_zip_codes": ["75002", "75201", "75204"],
        "hourly_rate": 90.0,
    },
]

SAMPLE_WORK_ORDERS = [
    {
        "client_id": "client-enterprise-retail-42",
        "title": "Upgrade POS Terminals & Cat6 Cabling",
        "description": "Replace 4 legacy POS terminals with new Verifone units and test ethernet drops.",
        "zip_code": "75001",
        "required_skills": ["POS", "Networking"],
        "budget": 350.0,
    },
    {
        "client_id": "client-logistics-hub-19",
        "title": "Install 8 IP Security Cameras in Warehouse",
        "description": "Mount and configure PoE dome cameras; terminate Cat6 cabling to patch panel.",
        "zip_code": "75006",
        "required_skills": ["CCTV", "Low Voltage Cabling"],
        "budget": 600.0,
    },
    {
        "client_id": "client-medical-center-07",
        "title": "Data Center Rack Cleanup & Patching",
        "description": "Re-cable 2 server racks, label all fiber optic links, and document patch topology.",
        "zip_code": "75201",
        "required_skills": ["Server Racks", "Fiber Optic"],
        "budget": 500.0,
    },
]


def seed():
    print("=" * 65)
    print(" DiZpatch Dummy Data Seeding")
    print("=" * 65)

    with httpx.Client(timeout=10.0) as client:
        # 1. Seed Providers
        print("\n[1/4] Registering Sample Field Technicians...")
        created_provider_ids = []
        for p in SAMPLE_PROVIDERS:
            try:
                resp = client.post(f"{PROVIDER_URL}/api/v1/providers", json=p)
                if resp.status_code == 201:
                    data = resp.json()
                    created_provider_ids.append(data["id"])
                    print(f"  ✓ Registered: {data['name']} ({data['email']}) -> ID: {data['id']}")
                elif resp.status_code == 409:
                    print(f"  • Already exists: {p['name']} ({p['email']})")
                else:
                    print(f"  ✗ Failed: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"  ✗ Connection error to provider-service ({PROVIDER_URL}): {e}")

        # 2. Seed Work Orders
        print("\n[2/4] Creating Enterprise Work Orders...")
        created_work_order_ids = []
        for wo in SAMPLE_WORK_ORDERS:
            try:
                idem_key = f"seed-{uuid.uuid4()}"
                trace_id = f"trace-{uuid.uuid4().hex[:12]}"
                resp = client.post(
                    f"{WORK_ORDER_URL}/api/v1/work-orders",
                    json=wo,
                    headers={"Idempotency-Key": idem_key, "X-Correlation-ID": trace_id},
                )
                if resp.status_code in (200, 201):
                    data = resp.json()
                    created_work_order_ids.append(data["id"])
                    print(f"  ✓ Created: '{data['title']}' (Zip: {data['zip_code']}) -> ID: {data['id']}")
                else:
                    print(f"  ✗ Failed to create work order: {resp.status_code} - {resp.text}")
            except Exception as e:
                print(f"  ✗ Connection error to work-order-service ({WORK_ORDER_URL}): {e}")

        # 3. Trigger Provider Matching
        print("\n[3/4] Triggering Strategy Pattern Matching for Work Orders...")
        matched_assignments = []
        for wo_id in created_work_order_ids:
            try:
                wo_resp = client.get(f"{WORK_ORDER_URL}/api/v1/work-orders/{wo_id}")
                if wo_resp.status_code == 200:
                    wo_data = wo_resp.json()
                    match_payload = {
                        "work_order_id": wo_id,
                        "zip_code": wo_data["zip_code"],
                        "required_skills": wo_data["required_skills"],
                        "strategy": "rating",
                    }
                    match_resp = client.post(f"{ASSIGNMENT_URL}/api/v1/assignments/match", json=match_payload)
                    if match_resp.status_code in (200, 201):
                        mdata = match_resp.json()
                        matched_providers = mdata.get("matched_providers", [])
                        matched_assignments.append((wo_id, matched_providers))
                        print(f"  ✓ Matched WO {wo_id[:8]}... with {len(matched_providers)} eligible technicians (Strategy: rating)")
            except Exception as e:
                print(f"  ✗ Matching error: {e}")

        # 4. Simulate a Technician Accepting a Work Order (triggers assignment & notification)
        print("\n[4/4] Simulating Job Acceptance & Notification Trigger...")
        if matched_assignments and matched_assignments[0][1]:
            first_wo_id, providers_list = matched_assignments[0]
            assigned_tech = providers_list[0]
            try:
                accept_resp = client.post(
                    f"{ASSIGNMENT_URL}/api/v1/assignments/{first_wo_id}/accept",
                    json={"provider_id": assigned_tech, "expected_version": 1},
                )
                if accept_resp.status_code == 200:
                    print(f"  ✓ Technician {assigned_tech[:8]}... accepted Work Order {first_wo_id[:8]}... (Status: ACCEPTED)")
                    print("  ✓ Outbox event 'AssignmentAccepted' created!")
                elif accept_resp.status_code == 409:
                    print(f"  • Work order already accepted or version conflict.")
                else:
                    print(f"  ✗ Failed to accept assignment: {accept_resp.status_code} - {accept_resp.text}")
            except Exception as e:
                print(f"  ✗ Accept error: {e}")

    print("\n" + "=" * 65)
    print(" Dummy Data Seeding Complete!")
    print("=" * 65)
    print("Next steps:")
    print("  1. Open Kafka UI: http://localhost:8080 to see events in real-time.")
    print("  2. Check notifications: curl http://localhost:8004/api/v1/notifications/logs")
    print("  3. Check work orders:   curl http://localhost:8001/api/v1/work-orders")
    print("=" * 65)


if __name__ == "__main__":
    seed()
