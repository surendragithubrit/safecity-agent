import unittest
from unittest.mock import Mock, patch

from app.services import email_service


class EmailServiceTests(unittest.TestCase):
    def setUp(self):
        self.payload = {
            "message": "Test alert",
            "urgency": "Low",
            "location": None,
            "recipient_email": "trusted@example.com",
            "trigger_source": "typed_distress",
        }

    def test_brevo_api_sends_email_over_https(self):
        with patch.multiple(
            email_service,
            BREVO_API_KEY="test-api-key",
            BREVO_SENDER_EMAIL="sender@example.com",
            BREVO_SENDER_NAME="SafeCity Test",
            SMTP_USERNAME="",
            SMTP_APP_PASSWORD="",
            ALERT_ALLOWED_RECIPIENTS={"trusted@example.com"},
        ):
            with patch("app.services.email_service.httpx.post") as post:
                email_service.send_alert_email(self.payload)

        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], email_service.BREVO_API_URL)
        self.assertEqual(kwargs["headers"]["api-key"], "test-api-key")
        self.assertEqual(
            kwargs["json"]["to"],
            [{"email": "trusted@example.com"}],
        )
        self.assertEqual(kwargs["json"]["sender"]["email"], "sender@example.com")
        post.return_value.raise_for_status.assert_called_once_with()

    def test_smtp_remains_available_when_brevo_is_not_configured(self):
        with patch.multiple(
            email_service,
            BREVO_API_KEY="",
            BREVO_SENDER_EMAIL="",
            SMTP_USERNAME="sender@example.com",
            SMTP_APP_PASSWORD="test-app-password",
            ALERT_ALLOWED_RECIPIENTS={"trusted@example.com"},
        ):
            with patch("app.services.email_service.smtplib.SMTP_SSL") as smtp_ssl:
                email_service.send_alert_email(self.payload)

        smtp = smtp_ssl.return_value.__enter__.return_value
        smtp_ssl.assert_called_once_with(
            email_service.SMTP_HOST,
            email_service.SMTP_PORT,
            timeout=email_service.SMTP_TIMEOUT_SECONDS,
        )
        smtp.login.assert_called_once_with("sender@example.com", "test-app-password")
        self.assertEqual(smtp.send_message.call_args.args[0]["To"], "trusted@example.com")


if __name__ == "__main__":
    unittest.main()
