# DiZpatch — Event-Driven Field-Service Marketplace Backend

**DiZpatch** is a distributed, high-throughput, event-driven field-service marketplace backend inspired by platforms like Field Nation. It connects enterprise clients needing on-site technical services (POS installs, fiber optic splicing, CCTV deployments, rack wiring) with certified field technicians.

The system is built as a **Database-per-Service** microservices architecture using **FastAPI**, **PostgreSQL 16**, **Apache Kafka (KRaft mode)**, and is fully configured via **`.env`** and orchestratable with **Podman Desktop** or **Docker Compose**.

---

## 1. System Architecture Overview

```text
                                  +──────────────────────────────────+
                                  |  API Consumers / Field App / Web |
                                  +────────────────-+────────────────+
                                                    | (HTTP + X-Correlation-ID)
         +──────────────────────────┬───────────────┴──────────────┬──────────────────────────+
         |                          |                              |                          |
         v :8001                    v :8002                        v :8003                    v :8004
+───────────────────+      +───────────────────+          +───────────────────+      +─────────────────────+
| work-order-service|      |  provider-service |          | assignment-service|      |notification-service |
| (FastAPI + SQLA)  |      |  (FastAPI + SQLA) |          | (FastAPI + SQLA)  |      |  (FastAPI + SQLA)   |
|                   |      |                   |          |                   |      |                     |
| - Keyset Cursor   |      | - Skills & Zips   |          | - Strategy Pattern|      | - Factory Pattern   |
|   Pagination      |      | - Ratings & Jobs  |          |   Ranking         |      |   (SMS/Email/Push)  |
| - Idempotency Key |      | - Geo-Match Query |          | - Optimistic Lock |      | - Idempotent Store  |
| - Outbox Events   |      |                   |          |   & UNIQUE TOCTOU |      | - Version Ordering  |
|   (ACID Tx)       |      |                   |          | - Outbox Events   |      |   Protection        |
+─────────┬─────────+      +─────────┬─────────+          +─────────┬─────────+      +──────────┬──────────+
          |                          |                              |                           |
          v                          v                              v                           v
+──────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    PostgreSQL 16 (Port 5432)                                         |
|  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  |
|  | dizpatch_work_orders|  |  dizpatch_providers |  | dizpatch_assignments|  |dizpatch_notification|  |
|  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  |
|               (Database-per-Service: Zero cross-database joins / isolated catalogs)                  |
+─────────┬─────────────────────────────────────────────────────────┬──────────────────────────────────+
          |                                                         |
          | (SELECT FOR UPDATE SKIP LOCKED)                         | (SKIP LOCKED)
          v                                                         v
+───────────────────+                                     +───────────────────+
|Work Order Relay   |                                     |Assignment Relay   |
+─────────┬─────────+                                     +─────────┬─────────+
          |                                                         |
          +───────────────────────────────┐     ┌───────────────────+
                                          |     |
                                          v     v
              =========================================================
                                  APACHE KAFKA (KRaft)
                • work-orders.WorkOrderCreated
                • work-orders.WorkOrderCancelled
                • assignments.ProvidersMatched
                • assignments.AssignmentAccepted
                • <topic>.DLQ (Dead Letter Queues)
              =========================================================
                               |                               |
                               | (Consumer: manual offset)     | (Consumer: manual offset)
                               v                               v
                    +────────────────────+           +───────────────────+
                    |assignment-consumer |           |notification-consum|
                    |                    |           |(Retry + Jitter/DLQ|
                    |Triggers provider   |           |Dispatches SMS,    |
                    |matching & ranking  |           |Email & Push Alerts|
                    +────────────────────+           +───────────────────+
```

---

## 2. Microservices Breakdown

| Service | Port | Database Catalog | Core Responsibilities & Patterns |
| :--- | :--- | :--- | :--- |
| **`work-order-service`** | `8001` | `dizpatch_work_orders` | Work order lifecycle (`OPEN` $\to$ `ASSIGNED` $\to$ `COMPLETED`, `CANCELLED`), **Keyset Cursor Pagination** (`WHERE (created_at, id) < (:ts, :id)`), **HTTP Idempotency-Key** deduplication, Transactional Outbox with `FOR UPDATE SKIP LOCKED`. |
| **`provider-service`** | `8002` | `dizpatch_providers` | Technician registry, skill sets, serviced zip codes, hourly rates, running average ratings, and availability status. |
| **`assignment-service`** | `8003` | `dizpatch_assignments` | Technician job matching using the **Strategy Pattern** (`DistanceRankingStrategy`, `RatingRankingStrategy`, `CostRankingStrategy`), TOCTOU race condition prevention via **Optimistic Locking** (`version` column) and database `UNIQUE(work_order_id)`. |
| **`notification-service`** | `8004` | `dizpatch_notifications` | Multi-channel alert dispatching via **Factory Pattern** (`NotificationSenderFactory` $\to$ SMS, Email, Push). Monotonically increasing version check and `processed_events` table for exactly-once processing semantics. |

---

## 3. Configuration & `.env`

All services, database credentials, ports, and Kafka settings are configured through `.env`:

```ini
# PostgreSQL Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=dizpatch
POSTGRES_PASSWORD=dizpatch_pass
POSTGRES_DB=dizpatch_work_orders

# Service Databases (Database-per-Service Architecture)
WORK_ORDER_DB=dizpatch_work_orders
PROVIDER_DB=dizpatch_providers
ASSIGNMENT_DB=dizpatch_assignments
NOTIFICATION_DB=dizpatch_notifications

# Connection Strings
WORK_ORDER_DATABASE_URL=postgresql+psycopg2://dizpatch:dizpatch_pass@postgres:5432/dizpatch_work_orders
PROVIDER_DATABASE_URL=postgresql+psycopg2://dizpatch:dizpatch_pass@postgres:5432/dizpatch_providers
ASSIGNMENT_DATABASE_URL=postgresql+psycopg2://dizpatch:dizpatch_pass@postgres:5432/dizpatch_assignments
NOTIFICATION_DATABASE_URL=postgresql+psycopg2://dizpatch:dizpatch_pass@postgres:5432/dizpatch_notifications

# Kafka Event Streaming
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_HOST_PORT=9092
KAFKA_EXTERNAL_PORT=29092
KAFKA_UI_PORT=8080

# Service Port Bindings
WORK_ORDER_SERVICE_PORT=8001
PROVIDER_SERVICE_PORT=8002
ASSIGNMENT_SERVICE_PORT=8003
NOTIFICATION_SERVICE_PORT=8004
```

---

## 4. Spin Up Instructions & Podman Troubleshooting

### 4.1 Troubleshooting the `i/o timeout` (Podman Machine DNS / Network)
If `podman compose build` fails with:
```text
dial tcp 100.26.133.58:443: i/o timeout
```
This is caused by the Podman WSL2 VM having a stale DNS resolver or temporary network blockage to Docker Hub (`registry-1.docker.io`). Run these quick resolution steps:

1. **Restart Podman Machine** (resets network interfaces & DNS):
   ```powershell
   podman machine stop
   podman machine start
   ```

2. **Configure Public DNS in the Podman VM**:
   ```powershell
   podman machine ssh "echo 'nameserver 8.8.8.8' | sudo tee /etc/resolv.conf"
   ```

3. **Pre-pull the base images** to warm the cache:
   ```powershell
   podman pull python:3.11-slim
   podman pull postgres:16-alpine
   podman pull apache/kafka:3.7.0
   podman pull provectuslabs/kafka-ui:latest
   ```

*(Note: If behind a corporate firewall or in a region where Docker Hub is restricted, connecting through Cloudflare WARP or VPN will immediately unblock the connection).*

### 4.2 Start the Stack
Once Podman is active:
```powershell
# Build and start all services in detached mode
podman compose up -d --build
```
*(If using the Podman Docker compatibility socket, `docker compose up -d --build` also works).*

---

## 5. End-to-End Walkthrough (cURL / HTTP)

### Step 1: Health Checks
```bash
curl -s http://localhost:8001/health/ready | jq
curl -s http://localhost:8002/health/ready | jq
curl -s http://localhost:8003/health/ready | jq
curl -s http://localhost:8004/health/ready | jq
```

### Step 2: Register Field Technicians (`provider-service`)
```bash
curl -X POST http://localhost:8002/api/v1/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Connor",
    "email": "sarah.connor@cybertech.org",
    "phone": "+1-555-0102",
    "skills": ["POS", "Networking", "Low Voltage Cabling"],
    "service_zip_codes": ["75001", "75002", "75201"],
    "hourly_rate": 75.0
  }'
```

### Step 3: Create a Work Order with Idempotency Key (`work-order-service`)
```bash
curl -i -X POST http://localhost:8001/api/v1/work-orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: client-req-unique-001" \
  -H "X-Correlation-ID: trace-abc-123" \
  -d '{
    "client_id": "enterprise-retail-corp",
    "title": "POS Terminal Installation & Cat6 Splicing",
    "description": "Install 2 new NCR terminals and terminate ethernet drops.",
    "zip_code": "75001",
    "required_skills": ["POS", "Networking"],
    "budget": 350.0
  }'
```

### Step 4: Keyset (Cursor) Pagination
```bash
# First page
curl -s "http://localhost:8001/api/v1/work-orders?limit=2" | jq

# Subsequent page
curl -s "http://localhost:8001/api/v1/work-orders?limit=2&cursor=<NEXT_CURSOR_BASE64>" | jq
```

### Step 5: Match Providers Using Strategy Pattern (`assignment-service`)
Strategies available: `rating`, `cost`, or `distance`.
```bash
curl -X POST http://localhost:8003/api/v1/assignments/match \
  -H "Content-Type: application/json" \
  -d '{
    "work_order_id": "<WORK_ORDER_ID>",
    "zip_code": "75001",
    "required_skills": ["POS"],
    "strategy": "cost"
  }'
```

### Step 6: Accept Work Order (Optimistic Locking & TOCTOU Race Interception)
Technician A accepts:
```bash
curl -i -X POST http://localhost:8003/api/v1/assignments/<WORK_ORDER_ID>/accept \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "<PROVIDER_ID>",
    "expected_version": 1
  }'
```
$\to$ **200 OK**

Technician B simultaneously attempts to accept:
```bash
curl -i -X POST http://localhost:8003/api/v1/assignments/<WORK_ORDER_ID>/accept \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "<ANOTHER_PROVIDER_ID>",
    "expected_version": 1
  }'
```
$\to$ **409 Conflict**

### Step 7: Inspect Dispatched Notification Logs
```bash
curl -s http://localhost:8004/api/v1/notifications/logs | jq
```

---

## 6. Automated Verification Suite (`pytest`)

```powershell
python -m pytest tests/ -v
```
All 9 test scenarios execute with 100% pass rate:
1. `test_concurrency_double_assignment_prevention`
2. `test_idempotent_event_replay`
3. `test_out_of_order_event_version_discard`
4. `test_poison_pill_routing_to_dlq_without_stalling_subsequent_messages`
5. `test_rating_ranking_strategy`
6. `test_cost_ranking_strategy`
7. `test_distance_ranking_strategy`
8. `test_strategy_factory`
9. `test_work_order_idempotency_and_pagination`

---

## 7. Populating Sample Data
```powershell
python scripts/seed_data.py
```
