import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "data" / "safecity.db"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "")
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "")
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "SafeCity Agent")
ALERT_ALLOWED_RECIPIENTS = {
    address.strip().casefold()
    for address in os.getenv("ALERT_ALLOWED_RECIPIENTS", "").split(",")
    if address.strip()
}
