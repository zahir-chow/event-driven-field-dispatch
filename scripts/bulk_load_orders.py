#!/usr/bin/env python3
"""
DiZpatch High-Throughput Bulk Order Generator
Simulates 1,000+ simultaneous enterprise work order creations using asynchronous HTTP concurrency.
Tests:
  - Ingestion throughput (Requests/sec)
  - Database-per-service PostgreSQL write scalability
  - Transactional Outbox bulk event generation
  - Apache Kafka streaming & consumer load
"""
import argparse
import asyncio
import os
import random
import socket
import subprocess
import sys
import time
import uuid
from typing import List, Dict, Any
import httpx

# Predefined realistic dummy data for field-service work orders
TITLES = [
    "Upgrade POS Terminals & Cat6 Cabling",
    "Install 8 IP Security Cameras in Warehouse",
    "Data Center Rack Cleanup & Patching",
    "Emergency Fiber Optic Splice",
    "Cisco Core Switch Replacement",
    "Low-Voltage Ethernet Drop Installation",
    "Access Control Keycard Reader Setup",
    "Wireless Access Point (WAP) Deployment",
    "Server PSU Replacement & Diagnostic",
    "Digital Signage Display Mounting",
    "Cellular Backup Gateway Configuration",
    "Workstation Hardware Refresh & Migration",
]

CLIENTS = [
    "client-enterprise-retail-42",
    "client-logistics-hub-19",
    "client-medical-center-07",
    "client-fintech-hub",
    "client-national-bank",
    "client-cloud-datacenter-east",
    "client-telecom-corp",
    "client-hospitality-suites",
]

ZIP_CODES = ["75001", "75002", "75006", "75007", "75201", "75202"]

SKILL_SETS = [
    ["POS", "Networking"],
    ["CCTV", "Access Control"],
    ["Fiber Optic", "Networking"],
    ["Server Racks", "Fiber Optic"],
    ["Hardware Repair", "Networking"],
    ["Low Voltage Cabling", "Digital Signage"],
    ["CCTV", "Security Alarms"],
    ["Networking", "Hardware Repair"],
]


def resolve_host() -> str:
    """Auto-detects whether to use localhost or the WSL2 Podman VM IP."""
    if os.environ.get("DIZPATCH_HOST"):
        return os.environ["DIZPATCH_HOST"]

    # 1. Quick probe localhost
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        s.connect(("127.0.0.1", 8001))
        s.close()
        return "127.0.0.1"
    except Exception:
        pass

    # 2. Check WSL2 IP if on Windows
    if sys.platform == "win32":
        for distro in ["podman-machine-default", "podman-machine-default-arm64"]:
            try:
                out = subprocess.check_output(
                    ["wsl", "-d", distro, "-u", "root", "ip", "-4", "addr", "show", "eth0"],
                    text=True,
                    timeout=2,
                    stderr=subprocess.DEVNULL,
                )
                for line in out.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 2 and parts[0] == "inet":
                        return parts[1].split("/")[0]
            except Exception:
                continue

    return "localhost"


def generate_work_order_payload(index: int) -> Dict[str, Any]:
    """Generates a randomized, realistic enterprise work order payload."""
    title_base = random.choice(TITLES)
    return {
        "title": f"{title_base} #{index + 1}",
        "description": f"Automated stress-test order {index + 1}. Site inspection and deployment required.",
        "client_id": random.choice(CLIENTS),
        "zip_code": random.choice(ZIP_CODES),
        "required_skills": random.choice(SKILL_SETS),
        "max_budget": round(random.uniform(150.0, 950.0), 2),
    }


async def send_single_order(
    client: httpx.AsyncClient,
    url: str,
    payload: Dict[str, Any],
    semaphore: asyncio.Semaphore,
    results: List[float],
    errors: List[str],
    progress_state: Dict[str, int],
    total: int,
):
    """Sends a single work order POST request with concurrency throttling."""
    idempotency_key = f"bulk-order-{uuid.uuid4()}"
    headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key,
    }

    async with semaphore:
        start_time = time.perf_counter()
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=15.0)
            latency = (time.perf_counter() - start_time) * 1000.0  # in ms
            if resp.status_code in (200, 201):
                results.append(latency)
            else:
                errors.append(f"HTTP {resp.status_code}: {resp.text[:80]}")
        except Exception as e:
            errors.append(str(e))
        finally:
            progress_state["completed"] += 1
            completed = progress_state["completed"]
            if completed % 50 == 0 or completed == total:
                pct = (completed / total) * 100
                bar_len = 30
                filled = int(bar_len * completed // total)
                bar = "█" * filled + "░" * (bar_len - filled)
                sys.stdout.write(f"\r  [{bar}] {completed}/{total} ({pct:.1f}%)")
                sys.stdout.flush()


async def run_bulk_load(count: int, concurrency: int, base_url: str):
    url = f"{base_url}/api/v1/work-orders"
    print("=" * 70)
    print(" 🚀 DiZpatch High-Throughput Bulk Order Ingestion")
    print("=" * 70)
    print(f"  • Target Endpoint:  {url}")
    print(f"  • Total Orders:     {count:,}")
    print(f"  • Concurrency:      {concurrency} simultaneous async workers")
    print(f"  • Outbox & Kafka:   Transactional Outbox enabled")
    print("=" * 70)
    print("Dispatching asynchronous requests...\n")

    semaphore = asyncio.Semaphore(concurrency)
    results: List[float] = []
    errors: List[str] = []
    progress_state = {"completed": 0}

    # High-performance HTTP client with connection pooling
    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits) as client:
        wall_start = time.perf_counter()

        tasks = [
            send_single_order(
                client=client,
                url=url,
                payload=generate_work_order_payload(i),
                semaphore=semaphore,
                results=results,
                errors=errors,
                progress_state=progress_state,
                total=count,
            )
            for i in range(count)
        ]

        await asyncio.gather(*tasks)

        wall_duration = time.perf_counter() - wall_start

    print("\n\n" + "=" * 70)
    print(" 📊 Ingestion Performance Summary")
    print("=" * 70)

    success_count = len(results)
    error_count = len(errors)
    throughput = success_count / wall_duration if wall_duration > 0 else 0

    print(f"  • Total Duration:     {wall_duration:.2f} seconds")
    print(f"  • Throughput:         {throughput:.1f} orders / second")
    print(f"  • Successful (201):   {success_count:,} ({success_count / count * 100:.1f}%)")
    print(f"  • Failed:             {error_count:,}")

    if results:
        results.sort()
        avg_lat = sum(results) / len(results)
        p50 = results[int(len(results) * 0.50)]
        p95 = results[int(len(results) * 0.95)]
        p99 = results[int(len(results) * 0.99)]
        min_lat = results[0]
        max_lat = results[-1]

        print(f"\n  Latency Distribution (Round-Trip per Order):")
        print(f"    - Min:              {min_lat:.1f} ms")
        print(f"    - Avg:              {avg_lat:.1f} ms")
        print(f"    - Median (p50):     {p50:.1f} ms")
        print(f"    - p95:              {p95:.1f} ms")
        print(f"    - p99:              {p99:.1f} ms")
        print(f"    - Max:              {max_lat:.1f} ms")

    if errors:
        print("\n  Sample Errors:")
        for err in errors[:5]:
            print(f"    ✗ {err}")

    print("=" * 70)
    print(" 🎉 1,000 Orders Ingested! What to Check Next:")
    print("   1. Open Kafka UI (http://172.17.68.210:8080) to watch 1,000 messages in 'work-orders.WorkOrderCreated'.")
    print("   2. Open the Web Dashboard (http://localhost:5173) to see the paginated orders and live event feed.")
    print("   3. Check database count:")
    print("      podman exec dizpatch-postgres psql -U dizpatch -d dizpatch_work_orders -c 'SELECT COUNT(*) FROM work_orders;'")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Bulk Order Ingestion Stress Tool for DiZpatch")
    parser.add_argument("-n", "--count", type=int, default=1000, help="Number of work orders to generate (default: 1000)")
    parser.add_argument("-c", "--concurrency", type=int, default=50, help="Simultaneous async connections (default: 50)")
    parser.add_argument("--host", type=str, default=None, help="Target host (e.g. localhost or 172.17.68.210)")

    args = parser.parse_args()

    host = args.host or resolve_host()
    base_url = f"http://{host}:8001"

    asyncio.run(run_bulk_load(count=args.count, concurrency=args.concurrency, base_url=base_url))


if __name__ == "__main__":
    main()
