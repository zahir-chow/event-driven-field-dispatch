import os
import json
import logging
from app.database import SessionLocal, engine, Base
from app.models import Assignment, AssignmentStatus, ProcessedEvent
from app.repository import AssignmentRepository
from app.service import AssignmentService
from shared.kafka_helpers import make_consumer, make_producer, commit_message
from shared.retry import process_with_retry, PoisonPillError, TransientError
from shared.middleware import configure_json_logging

configure_json_logging("assignment-consumer")
logger = logging.getLogger("dizpatch.assignment_consumer")

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC = "work-orders.WorkOrderCreated"
DLQ_TOPIC = f"{TOPIC}.DLQ"
GROUP_ID = "assignment-service-group"


def handle_work_order_created(raw_message):
    val = raw_message.value()
    if not val:
        raise PoisonPillError("Received empty Kafka message")

    try:
        data = json.loads(val.decode("utf-8"))
    except Exception as exc:
        raise PoisonPillError(f"Malformed JSON: {exc}") from exc

    event_id = data.get("event_id")
    event_type = data.get("event_type")
    incoming_version = data.get("version", 1)
    aggregate_id = data.get("aggregate_id") or (data.get("payload", {}).get("work_order_id"))

    if not event_id or not aggregate_id:
        raise PoisonPillError("Missing event_id or aggregate_id in event envelope")

    db = SessionLocal()
    try:
        repo = AssignmentRepository(db)

        # 1. Idempotency Check: check if event_id already processed
        if repo.get_processed_event(event_id):
            logger.info(f"Duplicate event {event_id} already processed. No-op.")
            return

        # 2. Version Ordering Protection: discard stale events
        max_seen_version = repo.get_max_processed_version(aggregate_id)
        if incoming_version <= max_seen_version:
            logger.warning(
                f"Discarding stale event {event_id} (version {incoming_version} <= max recorded version {max_seen_version})"
            )
            # Record as processed so we don't re-examine
            repo.record_processed_event(event_id, aggregate_id, incoming_version)
            db.commit()
            return

        # 3. Process business logic (Trigger matching for WorkOrderCreated)
        payload = data.get("payload", {})
        work_order_id = payload.get("work_order_id") or aggregate_id
        zip_code = payload.get("zip_code", "")
        required_skills = payload.get("required_skills", [])
        trace_id = data.get("trace_id")

        service = AssignmentService(repo, db)
        service.match_and_create_assignment(
            work_order_id=work_order_id,
            zip_code=zip_code,
            required_skills=required_skills,
            strategy_name="rating",
            trace_id=trace_id,
        )

        # 4. Record event as processed in SAME ACID transaction
        repo.record_processed_event(event_id, aggregate_id, incoming_version)
        db.commit()
        logger.info(f"Processed event {event_id} for work order {aggregate_id} (version {incoming_version})")

    except (PoisonPillError, ):
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        # Raise as TransientError to trigger retry backoff
        raise TransientError(f"Database/service transient error: {exc}") from exc
    finally:
        db.close()


def run_consumer():
    logger.info(f"Starting Assignment Kafka Consumer on topic '{TOPIC}'...")
    Base.metadata.create_all(bind=engine)

    consumer = make_consumer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        group_id=GROUP_ID,
        topics=[TOPIC],
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

            # Process with retry, backoff, and DLQ routing
            success = process_with_retry(
                handler=handle_work_order_created,
                raw_message=msg,
                producer=dlq_producer,
                dlq_topic=DLQ_TOPIC,
                max_retries=3,
            )

            # Manual offset commit only after DB transaction is committed or routed to DLQ
            commit_message(consumer, msg, asynchronous=False)

    except KeyboardInterrupt:
        logger.info("Assignment consumer shutting down...")
    finally:
        consumer.close()


if __name__ == "__main__":
    run_consumer()
