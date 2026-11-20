"""
FastAPI middleware for X-Correlation-ID propagation and structured JSON logging.
Thread-safe and async-safe using contextvars.
"""
import contextvars
import json
import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("dizpatch")

# Context variables for request tracing
correlation_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")
service_name_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("service_name", default="dizpatch")


def configure_json_logging(service_name: str, level: int = logging.INFO) -> None:
    """Configure root logger to emit structured JSON lines."""
    service_name_ctx.set(service_name)

    standard_keys = {
        "args", "asctime", "created", "exc_info", "exc_text",
        "filename", "funcName", "id", "levelname", "levelno",
        "lineno", "module", "msecs", "message", "msg", "name",
        "pathname", "process", "processName", "relativeCreated",
        "stack_info", "thread", "threadName", "taskName",
    }

    class JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            cid = getattr(record, "correlation_id", None) or correlation_id_ctx.get("")
            svc = getattr(record, "service", None) or service_name_ctx.get(service_name)

            log_obj: dict = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "service": svc,
                "logger": record.name,
                "correlation_id": cid,
                "message": record.getMessage(),
            }

            for key, value in record.__dict__.items():
                if key not in standard_keys and key not in log_obj:
                    log_obj[key] = value

            if record.exc_info:
                log_obj["exc_info"] = self.formatException(record.exc_info)
            return json.dumps(log_obj)

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Reads X-Correlation-ID from the request (or generates a new UUID4),
    attaches it to request.state, echoes it in the response header, and
    includes it in every structured log line emitted during the request.
    """

    HEADER = "X-Correlation-ID"

    def __init__(self, app: ASGIApp, service_name: str = "dizpatch") -> None:
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        correlation_id: str = request.headers.get(self.HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        token_cid = correlation_id_ctx.set(correlation_id)
        token_svc = service_name_ctx.set(self.service_name)

        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            logger.exception(
                "Unhandled exception",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            correlation_id_ctx.reset(token_cid)
            service_name_ctx.reset(token_svc)

        logger.info(
            "HTTP request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )

        response.headers[self.HEADER] = correlation_id
        return response


def add_correlation_middleware(app, service_name: str = "dizpatch") -> None:
    """Convenience helper to add CorrelationIdMiddleware to a FastAPI app."""
    app.add_middleware(CorrelationIdMiddleware, service_name=service_name)
