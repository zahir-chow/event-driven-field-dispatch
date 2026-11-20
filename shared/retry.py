"""
Retry utilities for Kafka consumers.

Classes:
  TransientError   — raised when a message processing error is recoverable.
  PoisonPillError  — raised when a message is permanently unprocessable.

Functions:
  exponential_backoff_with_jitter(attempt, base, cap) → float
  send_to_dlq(producer, dlq_topic, raw_message, error)
  process_with_retry(handler, raw_message, producer, dlq_topic, max_retries)
"""
import asyncio
import json
import logging
import random
import time
from typing import Callable, Any, Optional

try:
    from confluent_kafka import Message
except ImportError:
    class Message:  # type: ignore[no-redef]
        """Fallback stub when confluent_kafka is not installed locally."""
        def topic(self): return None
        def partition(self): return 0
        def offset(self): return 0
        def key(self): return None
        def value(self): return None
        def headers(self): return []

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------


class TransientError(Exception):
    """Raised when processing failed but may succeed on retry (e.g. DB timeout)."""


class PoisonPillError(Exception):
    """Raised when a message can never be processed (e.g. schema violation)."""


# ---------------------------------------------------------------------------
# Back-off helper
# ---------------------------------------------------------------------------


def exponential_backoff_with_jitter(
    attempt: int,
    base: float = 0.5,
    cap: float = 30.0,
) -> float:
    """
    Full-jitter exponential back-off.

    sleep = random(0, min(cap, base * 2**attempt))

    Args:
        attempt: Zero-based retry attempt index.
        base:    Base delay in seconds (default 0.5 s).
        cap:     Maximum delay in seconds (default 30 s).

    Returns:
        Seconds to sleep before the next attempt.
    """
    ceiling = min(cap, base * (2 ** attempt))
    return random.uniform(0, ceiling)


# ---------------------------------------------------------------------------
# Dead-letter queue
# ---------------------------------------------------------------------------


def send_to_dlq(
    producer,
    dlq_topic: str,
    raw_message: Message,
    error: Exception,
) -> None:
    """
    Publish *raw_message* to *dlq_topic* with error metadata in the headers.


    Args:
        producer:    confluent_kafka.Producer (already created).
        dlq_topic:   Name of the dead-letter topic.
        raw_message: The original Kafka Message that could not be processed.
        error:       The exception that caused the failure.
    """
    headers = {
        "dlq-original-topic": (raw_message.topic() or "").encode(),
        "dlq-original-partition": str(raw_message.partition()).encode(),
        "dlq-original-offset": str(raw_message.offset()).encode(),
        "dlq-error-type": type(error).__name__.encode(),
        "dlq-error-message": str(error).encode(),
    }
    # Preserve any original headers
    if raw_message.headers():
        for k, v in raw_message.headers():
            headers.setdefault(k, v)

    try:
        producer.produce(
            topic=dlq_topic,
            value=raw_message.value(),
            key=raw_message.key(),
            headers=list(headers.items()),
        )
        producer.poll(0)
        logger.warning(
            "Message sent to DLQ",
            extra={
                "dlq_topic": dlq_topic,
                "original_topic": raw_message.topic(),
                "original_offset": raw_message.offset(),
                "error": str(error),
            },
        )
    except Exception as dlq_exc:
        logger.error("Failed to send message to DLQ: %s", dlq_exc)


# ---------------------------------------------------------------------------
# Main retry wrapper
# ---------------------------------------------------------------------------


def process_with_retry(
    handler: Callable[[Message], None],
    raw_message: Message,
    producer=None,
    dlq_topic: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """
    Call *handler(raw_message)* with up to *max_retries* retries on TransientError.

    Behaviour:
      - TransientError  → retry with exponential back-off; after max_retries send to DLQ.
      - PoisonPillError → send to DLQ immediately (no retries).
      - Any other exception → treated as TransientError.

    Args:
        handler:     Callable that processes a Kafka Message.
        raw_message: The Kafka Message to process.
        producer:    confluent_kafka.Producer used to publish to the DLQ (optional).
        dlq_topic:   Name of the dead-letter topic (optional).
        max_retries: Maximum number of retry attempts (default 3).

    Returns:
        True if processing succeeded, False if the message was sent to the DLQ.
    """
    for attempt in range(max_retries + 1):
        try:
            handler(raw_message)
            return True

        except PoisonPillError as exc:
            logger.error(
                "Poison pill detected — skipping message",
                extra={
                    "attempt": attempt,
                    "topic": raw_message.topic(),
                    "offset": raw_message.offset(),
                    "error": str(exc),
                },
            )
            if producer and dlq_topic:
                send_to_dlq(producer, dlq_topic, raw_message, exc)
            return False

        except (TransientError, Exception) as exc:
            if attempt < max_retries:
                sleep_seconds = exponential_backoff_with_jitter(attempt)
                logger.warning(
                    "Transient error processing message; retrying",
                    extra={
                        "attempt": attempt + 1,
                        "max_retries": max_retries,
                        "sleep_seconds": round(sleep_seconds, 3),
                        "topic": raw_message.topic(),
                        "offset": raw_message.offset(),
                        "error": str(exc),
                    },
                )
                time.sleep(sleep_seconds)
            else:
                logger.error(
                    "Max retries exceeded — sending to DLQ",
                    extra={
                        "attempt": attempt,
                        "topic": raw_message.topic(),
                        "offset": raw_message.offset(),
                        "error": str(exc),
                    },
                )
                if producer and dlq_topic:
                    send_to_dlq(producer, dlq_topic, raw_message, exc)
                return False

    return False  # unreachable, but satisfies type checkers


# ---------------------------------------------------------------------------
# Async variant (optional)
# ---------------------------------------------------------------------------


async def async_process_with_retry(
    handler: Callable[[Message], Any],
    raw_message: Message,
    producer=None,
    dlq_topic: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """Async version of process_with_retry using asyncio.sleep for back-off."""
    for attempt in range(max_retries + 1):
        try:
            result = handler(raw_message)
            if asyncio.iscoroutine(result):
                await result
            return True

        except PoisonPillError as exc:
            logger.error(
                "Poison pill detected — skipping message",
                extra={"attempt": attempt, "error": str(exc)},
            )
            if producer and dlq_topic:
                send_to_dlq(producer, dlq_topic, raw_message, exc)
            return False

        except (TransientError, Exception) as exc:
            if attempt < max_retries:
                sleep_seconds = exponential_backoff_with_jitter(attempt)
                logger.warning(
                    "Transient error; retrying async",
                    extra={"attempt": attempt + 1, "sleep_seconds": round(sleep_seconds, 3), "error": str(exc)},
                )
                await asyncio.sleep(sleep_seconds)
            else:
                logger.error("Max retries exceeded (async) — sending to DLQ", extra={"error": str(exc)})
                if producer and dlq_topic:
                    send_to_dlq(producer, dlq_topic, raw_message, exc)
                return False

    return False
