import os
import time
import json
import logging
from datetime import datetime
from sqlalchemy import select
from app.database import SessionLocal, engine, Base
from app.models import OutboxEvent
from shared.outbox import OutboxStatus
from shared.kafka_helpers import make_producer, flush_producer
from shared.middleware import configure_json_logging

configure_json_logging("work-order-outbox-relay")
logger = logging.getLogger("dizpatch.outbox_relay")

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
POLL_INTERVAL = float(os.environ.get("OUTBOX_POLL_INTERVAL", "1.0"))
BATCH_SIZE = int(os.environ.get("OUTBOX_BATCH_SIZE", "50"))


def run_relay():
    logger.info("Starting Work Order Outbox Relay...", extra={"kafka": KAFKA_BOOTSTRAP})
    producer = make_producer(KAFKA_BOOTSTRAP)

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    while True:
        db = SessionLocal()
        try:
            # MySQL 8.0 FOR UPDATE SKIP LOCKED
            try:
                events = (
                    db.query(OutboxEvent)
                    .filter(OutboxEvent.status == OutboxStatus.PENDING)
                    .order_by(OutboxEvent.id.asc())
                    .limit(BATCH_SIZE)
                    .with_for_update(skip_locked=True)
                    .all()
                )
            except Exception:
                # Fallback if DB doesn't support SKIP LOCKED
                events = (
                    db.query(OutboxEvent)
                    .filter(OutboxEvent.status == OutboxStatus.PENDING)
                    .order_by(OutboxEvent.id.asc())
                    .limit(BATCH_SIZE)
                    .all()
                )

            if events:
                logger.info(f"Relaying {len(events)} outbox events")

            for event in events:
                topic = f"work-orders.{event.event_type}"
                key = event.aggregate_id.encode("utf-8")
                
                try:
                    payload_dict = json.loads(event.payload) if isinstance(event.payload, str) else event.payload
                except Exception:
                    payload_dict = {"raw": event.payload}

                envelope = {
                    "event_id": event.event_id,
                    "event_type": event.event_type,
                    "aggregate_type": event.aggregate_type,
                    "aggregate_id": event.aggregate_id,
                    "version": event.version,
                    "trace_id": event.trace_id,
                    "payload": payload_dict,
                    "created_at": event.created_at.isoformat() if event.created_at else datetime.utcnow().isoformat(),
                }

                value = json.dumps(envelope).encode("utf-8")
                headers = [
                    ("trace_id", (event.trace_id or "").encode("utf-8")),
                    ("event_id", event.event_id.encode("utf-8")),
                    ("event_type", event.event_type.encode("utf-8")),
                    ("version", str(event.version).encode("utf-8")),
                ]

                producer.produce(
                    topic=topic,
                    key=key,
                    value=value,
                    headers=headers,
                )
                event.status = OutboxStatus.PUBLISHED
                event.updated_at = datetime.utcnow()

            if events:
                flush_producer(producer, timeout=5.0)
                db.commit()
                logger.info(f"Successfully published {len(events)} events to Kafka")

        except Exception as e:
            db.rollback()
            logger.error(f"Error in outbox relay loop: {e}", exc_info=True)
        finally:
            db.close()

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_relay()
