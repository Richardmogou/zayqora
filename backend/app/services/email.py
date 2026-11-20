from dataclasses import dataclass
from email.message import EmailMessage
import logging
import smtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SentEmail:
    to: str
    subject: str
    body: str


outbox: list[SentEmail] = []


def clear_outbox() -> None:
    outbox.clear()


def send_email(to: str, subject: str, body: str) -> bool:
    recipient = to.strip()
    if not recipient:
        return False

    if not settings.smtp_host:
        outbox.append(SentEmail(to=recipient, subject=subject, body=body))
        logger.info("Email queued in dev outbox to=%s subject=%s", recipient, subject)
        return True

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_use_tls:
                client.starttls()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)
        return True
    except Exception:
        logger.exception("SMTP delivery failed to=%s subject=%s", recipient, subject)
        return False


def send_verification_email(to: str, full_name: str, token: str) -> bool:
    verify_url = f"{settings.site_url.rstrip('/')}/verify-email?token={token}"
    body = (
        f"Hello {full_name},\n\n"
        f"Please verify your ZAYQORA email address by opening the link below:\n{verify_url}\n\n"
        "This link expires in 24 hours."
    )
    return send_email(to, "Verify your ZAYQORA email address", body)


def send_password_reset_email(to: str, full_name: str, token: str) -> bool:
    reset_url = f"{settings.site_url.rstrip('/')}/reset-password?token={token}"
    body = (
        f"Hello {full_name},\n\n"
        f"A password reset was requested for your ZAYQORA account. Open the link below to set a new password:\n"
        f"{reset_url}\n\n"
        "This link expires in 1 hour. If you did not request this, you can ignore this email."
    )
    return send_email(to, "Reset your ZAYQORA password", body)


def send_order_confirmation_email(
    to: str,
    customer_name: str,
    restaurant_name: str,
    restaurant_slug: str,
    order_id: str,
    total_display: str,
) -> bool:
    tracking_url = f"{settings.site_url.rstrip('/')}/r/{restaurant_slug}/order-tracking/{order_id}"
    short_id = order_id[:8].upper()
    body = (
        f"Hello {customer_name},\n\n"
        f"Your order #{short_id} at {restaurant_name} has been received.\n"
        f"Total: {total_display}\n"
        f"Track your order: {tracking_url}\n"
    )
    return send_email(to, f"Order #{short_id} received — {restaurant_name}", body)


def send_reservation_email(
    to: str,
    customer_name: str,
    restaurant_name: str,
    guests: int,
    reserved_at_display: str,
    status: str,
) -> bool:
    status_label = status.replace("_", " ")
    body = (
        f"Hello {customer_name},\n\n"
        f"Your reservation for {guests} guest(s) at {restaurant_name} on {reserved_at_display} is currently {status_label}.\n"
    )
    return send_email(to, f"Reservation {status_label} — {restaurant_name}", body)


def send_contact_message_email(
    to: str,
    restaurant_name: str,
    sender_name: str,
    sender_email: str,
    message: str,
) -> bool:
    body = (
        f"New contact enquiry for {restaurant_name}\n"
        f"From: {sender_name} <{sender_email}>\n\n"
        f"{message}\n"
    )
    return send_email(to, f"New contact message — {restaurant_name}", body)
