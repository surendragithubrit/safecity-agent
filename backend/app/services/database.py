import json
import sqlite3
from pathlib import Path
from app.config import DATABASE_PATH

def get_connection():
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                urgency TEXT NOT NULL,
                location TEXT,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def save_alert(message, urgency, location, payload, status="DRAFT_READY"):
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO alerts(message, urgency, location, status, payload)
               VALUES (?, ?, ?, ?, ?)""",
            (message, urgency, location, status, json.dumps(payload))
        )
        conn.commit()
        return cur.lastrowid


def update_alert_status(alert_id, status):
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE alerts SET status = ? WHERE id = ?",
            (status, alert_id)
        )
        conn.commit()
        if cur.rowcount != 1:
            raise RuntimeError(f"Alert {alert_id} was not found while updating its status.")


def list_alerts():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts ORDER BY id DESC"
        ).fetchall()
        return [dict(row) for row in rows]
