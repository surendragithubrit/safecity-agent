import httpx
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.config import (
    ALERT_ALLOWED_RECIPIENTS,
    BREVO_API_KEY,
    BREVO_SENDER_EMAIL,
    BREVO_SENDER_NAME,
    SMTP_APP_PASSWORD,
    SMTP_USERNAME,
)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
SMTP_TIMEOUT_SECONDS = 15
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_TIMEOUT_SECONDS = 20


def email_is_configured() -> bool:
    return is_brevo_configured() or bool(SMTP_USERNAME and SMTP_APP_PASSWORD)


def is_brevo_configured() -> bool:
    return bool(BREVO_API_KEY and BREVO_SENDER_EMAIL)


def is_allowed_recipient(recipient_email: str) -> bool:
    return recipient_email.casefold() in ALERT_ALLOWED_RECIPIENTS


def send_alert_email(payload: dict) -> None:
    if not email_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Automatic email is not configured. Configure Brevo API settings or SMTP settings on the backend.",
        )
    if not is_allowed_recipient(payload["recipient_email"]):
        raise HTTPException(
            status_code=403,
            detail="This email address is not in ALERT_ALLOWED_RECIPIENTS on the backend.",
        )

    body = "\n".join(
        [
            "An automatic safety alert was sent by SafeCity Agent.",
            "",
            f"Urgency: {payload['urgency']}",
            f"Trigger: {payload.get('trigger_source', 'safety alert')}",
            f"Location: {payload.get('location') or 'Not shared'}",
            f"Message: {payload['message']}",
            "",
            "This is an automated message. If immediate help is needed, contact local emergency services.",
        ]
    )

    if is_brevo_configured():
        response = httpx.post(
            BREVO_API_URL,
            headers={
                "accept": "application/json",
                "api-key": BREVO_API_KEY,
                "content-type": "application/json",
            },
            json={
                "sender": {
                    "name": BREVO_SENDER_NAME,
                    "email": BREVO_SENDER_EMAIL,
                },
                "to": [{"email": payload["recipient_email"]}],
                "subject": f"SafeCity safety alert - {payload['urgency']} urgency",
                "textContent": body,
            },
            timeout=BREVO_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return

    message = EmailMessage()
    message["Subject"] = f"SafeCity safety alert - {payload['urgency']} urgency"
    message["From"] = SMTP_USERNAME
    message["To"] = payload["recipient_email"]
    message.set_content(body)

    with smtplib.SMTP_SSL(
        SMTP_HOST,
        SMTP_PORT,
        timeout=SMTP_TIMEOUT_SECONDS,
    ) as smtp:
        smtp.login(SMTP_USERNAME, SMTP_APP_PASSWORD)
        smtp.send_message(message)
