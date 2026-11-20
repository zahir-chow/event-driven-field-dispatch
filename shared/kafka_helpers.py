"""
Kafka producer / consumer factories using confluent-kafka.

Producer settings:
  - enable.idempotence=True  (exactly-once delivery guarantee)
  - acks=all

Consumer settings:
  - enable.auto.commit=False  (manual offset management)
"""
import logging
from typing import Optional, List, Callable, Any

try:
    from confluent_kafka import Producer, Consumer, KafkaException, KafkaError
    from confluent_kafka.admin import AdminClient, NewTopic
except ImportError:
    Producer = Any
    Consumer = Any
    KafkaException = Exception
    KafkaError = Any
    AdminClient = Any
    NewTopic = Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Producer
# ---------------------------------------------------------------------------

def make_producer(bootstrap_servers: str, extra_config: Optional[dict] = None) -> Producer:
    """
    Return an idempotent Kafka producer.

    Args:
        bootstrap_servers: Comma-separated list of broker addresses.
        extra_config: Additional confluent-kafka config overrides.
    """
    config = {
        "bootstrap.servers": bootstrap_servers,
        "enable.idempotence": True,
        "acks": "all",
        "retries": 5,
        "retry.backoff.ms": 300,
        "compression.type": "snappy",
        "linger.ms": 5,
        "batch.num.messages": 1000,
    }
    if extra_config:
        config.update(extra_config)

    producer = Producer(config)
    logger.info("Kafka producer created", extra={"bootstrap_servers": bootstrap_servers})
    return producer


def delivery_report(err, msg) -> None:
    """Default delivery callback — logs failures and successes."""
    if err is not None:
        logger.error(
            "Kafka delivery failed",
            extra={"topic": msg.topic(), "partition": msg.partition(), "error": str(err)},
        )
    else:
        logger.debug(
            "Kafka delivery succeeded",
            extra={"topic": msg.topic(), "partition": msg.partition(), "offset": msg.offset()},
        )


def produce(
    producer: Producer,
    topic: str,
    value: bytes,
    key: Optional[bytes] = None,
    headers: Optional[dict] = None,
    on_delivery: Optional[Callable] = None,
) -> None:
    """
    Produce a single message.  Flushes are left to the caller so that
    batching efficiency is preserved.
    """
    producer.produce(
        topic=topic,
        value=value,
        key=key,
        headers=list(headers.items()) if headers else None,
        on_delivery=on_delivery or delivery_report,
    )
    producer.poll(0)  # trigger delivery callbacks without blocking


def flush_producer(producer: Producer, timeout: float = 10.0) -> None:
    """Block until all in-flight messages are delivered (or timeout)."""
    remaining = producer.flush(timeout)
    if remaining > 0:
        logger.warning("Kafka flush timed out; %d messages still in queue", remaining)


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------

def make_consumer(
    bootstrap_servers: str,
    group_id: str,
    topics: List[str],
    extra_config: Optional[dict] = None,
    auto_offset_reset: str = "earliest",
) -> Consumer:
    """
    Return a Kafka consumer with manual commit.

    Args:
        bootstrap_servers: Comma-separated list of broker addresses.
        group_id: Consumer group identifier.
        topics: List of topic names to subscribe to.
        extra_config: Additional confluent-kafka config overrides.
        auto_offset_reset: Where to start when no committed offset exists.
    """
    config = {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        "enable.auto.commit": False,
        "auto.offset.reset": auto_offset_reset,
        "max.poll.interval.ms": 300_000,
        "session.timeout.ms": 45_000,
        "heartbeat.interval.ms": 3_000,
    }
    if extra_config:
        config.update(extra_config)

    consumer = Consumer(config)
    consumer.subscribe(topics)
    logger.info(
        "Kafka consumer created",
        extra={"bootstrap_servers": bootstrap_servers, "group_id": group_id, "topics": topics},
    )
    return consumer


def commit_message(consumer: Consumer, message: Any, asynchronous: bool = False) -> None:
    """Commit the offset of *message* (synchronously by default)."""
    consumer.commit(message=message, asynchronous=asynchronous)


# ---------------------------------------------------------------------------
# AdminClient helpers
# ---------------------------------------------------------------------------

def make_admin_client(bootstrap_servers: str) -> AdminClient:
    return AdminClient({"bootstrap.servers": bootstrap_servers})


def ensure_topics(
    bootstrap_servers: str,
    topics: List[str],
    num_partitions: int = 3,
    replication_factor: int = 1,
) -> None:
    """Create topics if they do not already exist (idempotent)."""
    admin = make_admin_client(bootstrap_servers)
    new_topics = [
        NewTopic(t, num_partitions=num_partitions, replication_factor=replication_factor)
        for t in topics
    ]
    futures = admin.create_topics(new_topics)
    for topic, future in futures.items():
        try:
            future.result()
            logger.info("Kafka topic created: %s", topic)
        except KafkaException as exc:
            # Topic already exists — that's fine
            if exc.args[0].code() == KafkaError.TOPIC_ALREADY_EXISTS:
                logger.debug("Kafka topic already exists: %s", topic)
            else:
                raise
