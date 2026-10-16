import asyncio
import logging
import smtplib

from fastapi import HTTPException

from app.services.database import save_alert, update_alert_status
from app.services.email_service import (
    email_is_configured,
    is_allowed_recipient,
    send_alert_email,
)

logger = logging.getLogger(__name__)

AUTOMATIC_TRIGGERS = {
    "voice_distress",
    "typed_distress",
    "journey_missed_checkin",
    "journey_overdue",
}


async def prepare_alert(data: dict):
    trigger_source = data.get("trigger_source", "user_confirmed")
    automatic_trigger = trigger_source in AUTOMATIC_TRIGGERS
    payload = {
        "message": data["message"],
        "urgency": data["urgency"],
        "location": data.get("location"),
        "recipient_email": data["recipient_email"],
        "confirmed_by_user": data["confirmed_by_user"],
        "trigger_source": trigger_source,
        "notice": (
            "Automatic email sent."
            if automatic_trigger
            else "Draft prepared only. Review and send it from your email app."
        )
    }

    if not data["confirmed_by_user"] and not automatic_trigger:
        return {
            "prepared": False,
            "sent": False,
            "message": "User confirmation is required before preparing an alert draft.",
            "payload": payload
        }

    if automatic_trigger and not email_is_configured():
        raise HTTPException(
            status_code=503,
            detail="Automatic email is not configured. Add SMTP_USERNAME and SMTP_APP_PASSWORD to backend/.env, then restart the backend.",
        )
    if automatic_trigger and not is_allowed_recipient(data["recipient_email"]):
        raise HTTPException(
            status_code=403,
            detail="This email address is not in ALERT_ALLOWED_RECIPIENTS in backend/.env.",
        )

    alert_id = save_alert(
        message=data["message"],
        urgency=data["urgency"],
        location=data.get("location"),
        payload=payload,
        status="SENDING" if automatic_trigger else "DRAFT_READY"
    )

    if automatic_trigger:
        try:
            await asyncio.to_thread(send_alert_email, payload)
        except HTTPException:
            update_alert_status(alert_id, "SEND_FAILED")
            raise
        except (OSError, smtplib.SMTPException):
            update_alert_status(alert_id, "SEND_FAILED")
            logger.exception("Automatic SafeCity alert email delivery failed.")
            raise HTTPException(
                status_code=502,
                detail="The alert was recorded, but email delivery failed. Check the Gmail SMTP settings and backend logs.",
            ) from None
        update_alert_status(alert_id, "SENT")

    return {
        "prepared": True,
        "sent": automatic_trigger,
        "status": "SENT" if automatic_trigger else "DRAFT_READY",
        "alert_id": alert_id,
        "message": (
            f"Automatic safety email sent to {data['recipient_email']}."
            if automatic_trigger else
            "Email draft is ready; open it and press Send."
        ),
        "payload": payload
    }
