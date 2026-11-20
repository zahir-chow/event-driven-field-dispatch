import json
import pytest
from typing import List, Dict, Any

from shared.retry import (
    process_with_retry,
    PoisonPillError,
    TransientError,
    send_to_dlq,
)


class MockKafkaMessage:
    def __init__(self, topic: str, value: bytes, partition: int = 0, offset: int = 100, headers=None):
        self._topic = topic
        self._value = value
        self._partition = partition
        self._offset = offset
        self._headers = headers or []

    def topic(self):
        return self._topic

    def partition(self):
        return self._partition

    def offset(self):
        return self._offset

    def key(self):
        return b"test-key"

    def value(self):
        return self._value

    def headers(self):
        return self._headers


class MockDLQProducer:
    def __init__(self):
        self.produced_records: List[Dict[str, Any]] = []

    def produce(self, topic: str, value: bytes, key=None, headers=None):
        self.produced_records.append({
            "topic": topic,
            "value": value,
            "key": key,
            "headers": dict(headers) if headers else {},
        })

    def poll(self, timeout=0):
        pass


def test_poison_pill_routing_to_dlq_without_stalling_subsequent_messages():
    """
    Test 4: Error Classification & Dead Letter Queue (DLQ)
    Sends a malformed/corrupted payload (Poison Pill).
    Asserts:
      - The consumer classifies it as a PoisonPillError.
      - It is immediately routed to the '<topic>.DLQ' topic with error headers.
      - Subsequent valid messages are processed successfully without head-of-line blocking.
    """
    mock_producer = MockDLQProducer()
    dlq_topic = "work-orders.WorkOrderCreated.DLQ"
    processed_valid_messages = []

    def consumer_handler(raw_msg):
        val = raw_msg.value()
        try:
            parsed = json.loads(val.decode("utf-8"))
            processed_valid_messages.append(parsed)
        except Exception as exc:
            # Classification as permanent Poison Pill
            raise PoisonPillError(f"Malformed JSON schema: {exc}") from exc

    # Message 1: Malformed poison pill (corrupted JSON)
    poison_pill_msg = MockKafkaMessage(
        topic="work-orders.WorkOrderCreated",
        value=b"CORRUPTED_{{{NOT_VALID_JSON@@@}",
        offset=101,
    )

    # Process poison pill
    res1 = process_with_retry(
        handler=consumer_handler,
        raw_message=poison_pill_msg,
        producer=mock_producer,
        dlq_topic=dlq_topic,
        max_retries=3,
    )
    # Poison pill returns False (failed processing, routed to DLQ)
    assert res1 is False

    # Assert poison pill landed in DLQ
    assert len(mock_producer.produced_records) == 1
    dlq_record = mock_producer.produced_records[0]
    assert dlq_record["topic"] == dlq_topic
    assert dlq_record["value"] == poison_pill_msg.value()
    assert "dlq-error-type" in dlq_record["headers"]
    assert dlq_record["headers"]["dlq-error-type"] == b"PoisonPillError"

    # Message 2: Subsequent valid message
    valid_payload = {"work_order_id": "wo-999", "status": "OPEN", "valid": True}
    valid_msg = MockKafkaMessage(
        topic="work-orders.WorkOrderCreated",
        value=json.dumps(valid_payload).encode("utf-8"),
        offset=102,
    )

    # Process valid message
    res2 = process_with_retry(
        handler=consumer_handler,
        raw_message=valid_msg,
        producer=mock_producer,
        dlq_topic=dlq_topic,
        max_retries=3,
    )

    # Valid message succeeded without head-of-line blocking!
    assert res2 is True
    assert len(processed_valid_messages) == 1
    assert processed_valid_messages[0]["work_order_id"] == "wo-999"

    # DLQ count remained at 1 (no spurious routing)
    assert len(mock_producer.produced_records) == 1
