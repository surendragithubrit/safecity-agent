import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.config import ALERT_ALLOWED_RECIPIENTS, SMTP_APP_PASSWORD, SMTP_USERNAME

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
SMTP_TIMEOUT_SECONDS = 15


def email_is_configured() -> bool:
    return bool(SMTP_USERNAME and SMTP_APP_PASSWORD)


def is_allowed_recipient(recipient_email: str) -> bool:
    return recipient_email.casefold() in ALERT_ALLOWED_RECIPIENTS


def send_alert_email(payload: dict) -> None:
    if not email_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Automatic email is not configured. Add SMTP_USERNAME and SMTP_APP_PASSWORD to backend/.env, then restart the backend.",
        )
    if not is_allowed_recipient(payload["recipient_email"]):
        raise HTTPException(
            status_code=403,
            detail="This email address is not in ALERT_ALLOWED_RECIPIENTS in backend/.env.",
        )

    message = EmailMessage()
    message["Subject"] = f"SafeCity safety alert - {payload['urgency']} urgency"
    message["From"] = SMTP_USERNAME
    message["To"] = payload["recipient_email"]
    message.set_content(
        "\n".join(
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
    )

    with smtplib.SMTP_SSL(
        SMTP_HOST,
        SMTP_PORT,
        timeout=SMTP_TIMEOUT_SECONDS,
    ) as smtp:
        smtp.login(SMTP_USERNAME, SMTP_APP_PASSWORD)
        smtp.send_message(message)
