import os
import json
import logging
from app.database import SessionLocal, engine, Base
from app.repository import NotificationRepository
from app.service import NotificationService
from shared.kafka_helpers import make_consumer, make_producer, commit_message
from shared.retry import process_with_retry, PoisonPillError, TransientError
from shared.middleware import configure_json_logging

configure_json_logging("notification-consumer")
logger = logging.getLogger("dizpatch.notification_consumer")

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPICS = [
    "work-orders.WorkOrderCreated",
    "work-orders.WorkOrderCancelled",
    "assignments.ProvidersMatched",
    "assignments.AssignmentAccepted",
]
GROUP_ID = "notification-service-group"


def handle_notification_message(raw_message):
    val = raw_message.value()
    if not val:
        raise PoisonPillError("Received empty Kafka message")

    try:
        data = json.loads(val.decode("utf-8"))
    except Exception as exc:
        raise PoisonPillError(f"Malformed JSON payload: {exc}") from exc

    event_id = data.get("event_id")
    event_type = data.get("event_type")
    aggregate_id = data.get("aggregate_id")

    if not event_id or not aggregate_id:
        raise PoisonPillError("Missing required event envelope fields (event_id, aggregate_id)")

    db = SessionLocal()
    try:
        repo = NotificationRepository(db)
        service = NotificationService(repo, db)
        service.process_domain_event(data)
    except PoisonPillError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise TransientError(f"Notification processing transient error: {exc}") from exc
    finally:
        db.close()


def run_consumer():
    logger.info(f"Starting Notification Kafka Consumer for topics: {TOPICS}...")
    Base.metadata.create_all(bind=engine)

    consumer = make_consumer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=GROUP_ID,
        topics=TOPICS,
        auto_offset_reset="earliest",
    )
    dlq_producer = make_producer(KAFKA_BOOTSTRAP)

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                logger.error(f"Consumer error: {msg.error()}")
                continue

            current_topic = msg.topic() or "notifications"
            dlq_topic = f"{current_topic}.DLQ"

            # Execute with exponential backoff + jitter and DLQ routing
            process_with_retry(
                handler=handle_notification_message,
                raw_message=msg,
                producer=dlq_producer,
                dlq_topic=dlq_topic,
                max_retries=3,
            )

            # Manual offset commit only after local transaction commits or DLQ is saved
            commit_message(consumer, msg, asynchronous=False)

    except KeyboardInterrupt:
        logger.info("Notification consumer shutting down...")
    finally:
        consumer.close()


if __name__ == "__main__":
    run_consumer()
