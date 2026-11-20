import logging
from abc import ABC, abstractmethod
from typing import Optional
from app.models import NotificationChannel

logger = logging.getLogger("dizpatch.notification_sender")


class NotificationSender(ABC):
    @abstractmethod
    def send(self, recipient: str, message: str, subject: Optional[str] = None) -> bool:
        """Dispatches notification to the recipient and returns True on success."""
        pass


class SmsSender(NotificationSender):
    def send(self, recipient: str, message: str, subject: Optional[str] = None) -> bool:
        logger.info(
            f"[SMS DISPATCH] To: {recipient} | Message: {message}",
            extra={"channel": "SMS", "recipient": recipient},
        )
        return True


class EmailSender(NotificationSender):
    def send(self, recipient: str, message: str, subject: Optional[str] = None) -> bool:
        logger.info(
            f"[EMAIL DISPATCH] To: {recipient} | Subject: {subject or 'DiZpatch Notification'} | Body: {message}",
            extra={"channel": "EMAIL", "recipient": recipient, "subject": subject},
        )
        return True


class PushSender(NotificationSender):
    def send(self, recipient: str, message: str, subject: Optional[str] = None) -> bool:
        logger.info(
            f"[PUSH NOTIFICATION] Target Device/User: {recipient} | Title: {subject or 'DiZpatch Alert'} | Body: {message}",
            extra={"channel": "PUSH", "recipient": recipient},
        )
        return True


class NotificationSenderFactory:
    """
    Factory Pattern implementation for creating channel-specific notification senders.
    """

    _senders = {
        NotificationChannel.SMS: SmsSender(),
        NotificationChannel.EMAIL: EmailSender(),
        NotificationChannel.PUSH: PushSender(),
    }

    @classmethod
    def get_sender(cls, channel: NotificationChannel) -> NotificationSender:
        sender = cls._senders.get(channel)
        if not sender:
            # Default to Email if unknown
            sender = cls._senders[NotificationChannel.EMAIL]
        return sender
