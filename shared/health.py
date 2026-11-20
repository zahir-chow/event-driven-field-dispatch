"""
Reusable health-check router factory.

Usage:
    from shared.health import make_health_router
    from sqlalchemy import create_engine

    engine = create_engine(DATABASE_URL)
    router = make_health_router(engine, KAFKA_BOOTSTRAP, "work-order-service")
    app.include_router(router)

Endpoints
---------
GET /health/live   — always 200; confirms the process is alive.
GET /health/ready  — checks MySQL (SELECT 1) and Kafka (list_topics).
                     Returns 200 when all deps are healthy, 503 otherwise.
"""
import logging
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def make_health_router(
    engine: Engine,
    kafka_bootstrap: str,
    service_name: str,
    timeout_seconds: float = 5.0,
) -> APIRouter:
    """
    Build and return an APIRouter with /health/live and /health/ready.

    Args:
        engine:           SQLAlchemy engine used to probe MySQL.
        kafka_bootstrap:  Comma-separated Kafka broker addresses.
        service_name:     Human-readable name embedded in every response body.
        timeout_seconds:  Timeout for each dependency probe.
    """
    router = APIRouter(tags=["health"])

    # ------------------------------------------------------------------
    # /health/live  — liveness (is the process up?)
    # ------------------------------------------------------------------

    @router.get("/health/live", summary="Liveness probe")
    async def liveness():
        return {"status": "alive", "service": service_name}

    # ------------------------------------------------------------------
    # /health/ready  — readiness (can we serve traffic?)
    # ------------------------------------------------------------------

    @router.get("/health/ready", summary="Readiness probe")
    async def readiness():
        checks: dict = {}
        healthy = True

        # ---- MySQL check ----
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["mysql"] = {"status": "ok"}
        except Exception as exc:
            logger.error("Health check: MySQL failed — %s", exc)
            checks["mysql"] = {"status": "error", "detail": str(exc)}
            healthy = False

        # ---- Kafka check ----
        try:
            from confluent_kafka.admin import AdminClient

            admin = AdminClient(
                {
                    "bootstrap.servers": kafka_bootstrap,
                    "socket.timeout.ms": int(timeout_seconds * 1000),
                    "request.timeout.ms": int(timeout_seconds * 1000),
                }
            )
            # list_topics() raises on connection failure
            metadata = admin.list_topics(timeout=timeout_seconds)
            topic_count = len(metadata.topics)
            checks["kafka"] = {"status": "ok", "topic_count": topic_count}
        except Exception as exc:
            logger.error("Health check: Kafka failed — %s", exc)
            checks["kafka"] = {"status": "error", "detail": str(exc)}
            healthy = False

        status_code = 200 if healthy else 503
        body = {
            "status": "ready" if healthy else "not_ready",
            "service": service_name,
            "checks": checks,
        }
        return JSONResponse(content=body, status_code=status_code)

    return router
