import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import NotificationLog, NotificationChannel, NotificationStatus
from app.repository import NotificationRepository
from app.schemas import NotificationLogResponse
from app.sender_factory import NotificationSenderFactory


class NotificationService:
    def __init__(self, repo: NotificationRepository, db: Session):
        self.repo = repo
        self.db = db

    def list_logs(self, limit: int = 100, offset: int = 0) -> List[NotificationLogResponse]:
        items = self.repo.list_logs(limit=limit, offset=offset)
        return [NotificationLogResponse.model_validate(i) for i in items]

    def get_logs_for_event(self, event_id: str) -> List[NotificationLogResponse]:
        items = self.repo.list_by_event_id(event_id)
        return [NotificationLogResponse.model_validate(i) for i in items]

    def dispatch_notification(
        self,
        event_id: str,
        event_type: str,
        recipient: str,
        channel: NotificationChannel,
        message: str,
        subject: Optional[str] = None,
        version: int = 1,
    ) -> NotificationLog:
        sender = NotificationSenderFactory.get_sender(channel)
        success = sender.send(recipient=recipient, message=message, subject=subject)

        log = NotificationLog(
            id=str(uuid.uuid4()),
            event_id=event_id,
            event_type=event_type,
            recipient=recipient,
            channel=channel,
            subject=subject,
            message=message,
            status=NotificationStatus.SENT if success else NotificationStatus.FAILED,
            version=version,
            created_at=datetime.utcnow(),
        )
        self.repo.create_log(log)
        return log

    def process_domain_event(self, envelope: dict) -> bool:
        """
        Processes an incoming domain event with:
        1. Idempotency protection (processed_events table check)
        2. Version ordering protection (discard incoming.version <= local.version)
        3. Multi-channel dispatch via NotificationSenderFactory
        """
        event_id = envelope.get("event_id")
        event_type = envelope.get("event_type")
        aggregate_id = envelope.get("aggregate_id")
        incoming_version = envelope.get("version", 1)
        payload = envelope.get("payload", {})

        if not event_id or not aggregate_id:
            return False

        # 1. Idempotency Check
        if self.repo.get_processed_event(event_id):
            return True  # Already processed safely

        # 2. Version Ordering Protection: check against latest version for this aggregate
        max_seen = self.repo.get_max_processed_version(aggregate_id)
        if incoming_version <= max_seen:
            # Stale / out-of-order event, discard
            self.repo.record_processed_event(event_id, aggregate_id, incoming_version)
            self.db.commit()
            return True

        # 3. Dispatch relevant notifications
        if event_type == "WorkOrderCreated":
            client_id = payload.get("client_id", "client")
            self.dispatch_notification(
                event_id=event_id,
                event_type=event_type,
                recipient=f"client-{client_id}@example.com",
                channel=NotificationChannel.EMAIL,
                subject=f"Work Order Created: {payload.get('title')}",
                message=f"Your work order '{payload.get('title')}' in zip {payload.get('zip_code')} has been posted.",
                version=incoming_version,
            )

        elif event_type == "ProvidersMatched":
            matched_ids = payload.get("matched_provider_ids", [])
            for pid in matched_ids:
                self.dispatch_notification(
                    event_id=event_id,
                    event_type=event_type,
                    recipient=f"provider-{pid}@dizpatch.local",
                    channel=NotificationChannel.PUSH,
                    subject="New Job Opportunity Available",
                    message=f"A matching work order {payload.get('work_order_id')} is open for acceptance.",
                    version=incoming_version,
                )

        elif event_type == "AssignmentAccepted":
            provider_id = payload.get("provider_id", "provider")
            wo_id = payload.get("work_order_id", aggregate_id)
            self.dispatch_notification(
                event_id=event_id,
                event_type=event_type,
                recipient=f"+1-555-PROVIDER-{provider_id[:4]}",
                channel=NotificationChannel.SMS,
                message=f"You have been assigned to work order {wo_id}!",
                version=incoming_version,
            )
            self.dispatch_notification(
                event_id=event_id,
                event_type=event_type,
                recipient=f"client-wo-{wo_id[:4]}@example.com",
                channel=NotificationChannel.EMAIL,
                subject=f"Technician Assigned to Work Order {wo_id}",
                message=f"Technician {provider_id} has accepted your work order.",
                version=incoming_version,
            )

        elif event_type == "WorkOrderCancelled":
            wo_id = payload.get("work_order_id", aggregate_id)
            self.dispatch_notification(
                event_id=event_id,
                event_type=event_type,
                recipient=f"all-parties-wo-{wo_id[:4]}@example.com",
                channel=NotificationChannel.EMAIL,
                subject=f"Work Order {wo_id} Cancelled",
                message=f"Work order {wo_id} was cancelled. Reason: {payload.get('reason')}",
                version=incoming_version,
            )

        # 4. Record event as processed in same transaction
        self.repo.record_processed_event(event_id, aggregate_id, incoming_version)

        # 5. Commit
        self.db.commit()
        return True
