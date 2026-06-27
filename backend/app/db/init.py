"""Database initialization and connection management."""

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from app.db.schema import ALL_TABLES

DB_PATH_DEFAULT = os.environ.get("DB_PATH", "/app/db/finally.db")

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]


def init_db(db_path: str = DB_PATH_DEFAULT) -> None:
    """Create tables and seed default data if not already present."""
    # Create parent directory if it doesn't exist
    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA journal_mode=WAL")

        # Create all tables
        for table_sql in ALL_TABLES:
            conn.execute(table_sql)

        # Seed default user if not exists
        existing = conn.execute(
            "SELECT id FROM users_profile WHERE id = 'default'"
        ).fetchone()
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                ("default", 10000.0, now),
            )

        # Seed default watchlist tickers if not exists
        now = datetime.now(timezone.utc).isoformat()
        for ticker in DEFAULT_TICKERS:
            existing = conn.execute(
                "SELECT id FROM watchlist WHERE user_id = 'default' AND ticker = ?",
                (ticker,),
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), "default", ticker, now),
                )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_db_connection(db_path: str = DB_PATH_DEFAULT):
    """Context manager returning sqlite3.Connection with Row factory."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
