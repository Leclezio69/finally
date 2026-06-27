"""Database query functions for the FinAlly application."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


# --- User / Portfolio ---


def get_user(conn: sqlite3.Connection, user_id: str = "default") -> dict | None:
    """Return the user profile dict or None if not found."""
    row = conn.execute(
        "SELECT id, cash_balance, created_at FROM users_profile WHERE id = ?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def update_cash_balance(
    conn: sqlite3.Connection, delta: float, user_id: str = "default"
) -> float:
    """Adjust cash balance by delta (positive = credit, negative = debit). Returns new balance."""
    conn.execute(
        "UPDATE users_profile SET cash_balance = cash_balance + ? WHERE id = ?",
        (delta, user_id),
    )
    row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)
    ).fetchone()
    return row["cash_balance"]


# --- Watchlist ---


def get_watchlist(conn: sqlite3.Connection, user_id: str = "default") -> list[dict]:
    """Return all watchlist entries for the user, ordered by added_at ASC."""
    rows = conn.execute(
        "SELECT id, ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at ASC",
        (user_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def add_to_watchlist(
    conn: sqlite3.Connection, ticker: str, user_id: str = "default"
) -> dict:
    """Add ticker to watchlist. Raises ValueError if already present."""
    entry_id = _uuid()
    added_at = _now()
    try:
        conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            (entry_id, user_id, ticker.upper(), added_at),
        )
    except Exception as exc:
        # UNIQUE constraint violation
        if "UNIQUE" in str(exc).upper():
            raise ValueError(f"Ticker {ticker.upper()} is already in the watchlist") from exc
        raise
    return {"id": entry_id, "ticker": ticker.upper(), "added_at": added_at}


def remove_from_watchlist(
    conn: sqlite3.Connection, ticker: str, user_id: str = "default"
) -> bool:
    """Remove ticker from watchlist. Returns True if removed, False if not found."""
    cursor = conn.execute(
        "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
        (user_id, ticker.upper()),
    )
    return cursor.rowcount > 0


# --- Positions ---


def get_positions(conn: sqlite3.Connection, user_id: str = "default") -> list[dict]:
    """Return all positions for the user, ordered by ticker ASC."""
    rows = conn.execute(
        "SELECT id, ticker, quantity, avg_cost, updated_at FROM positions WHERE user_id = ? ORDER BY ticker ASC",
        (user_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_position(
    conn: sqlite3.Connection, ticker: str, user_id: str = "default"
) -> dict | None:
    """Return a single position dict or None if not found."""
    row = conn.execute(
        "SELECT id, ticker, quantity, avg_cost, updated_at FROM positions WHERE user_id = ? AND ticker = ?",
        (user_id, ticker.upper()),
    ).fetchone()
    return dict(row) if row else None


def upsert_position(
    conn: sqlite3.Connection,
    ticker: str,
    quantity: float,
    avg_cost: float,
    user_id: str = "default",
) -> None:
    """Insert or update a position. If quantity <= 0, deletes the position."""
    ticker = ticker.upper()
    if quantity <= 0:
        delete_position(conn, ticker, user_id)
        return

    now = _now()
    # Try to update existing row first
    cursor = conn.execute(
        """
        UPDATE positions
        SET quantity = ?, avg_cost = ?, updated_at = ?
        WHERE user_id = ? AND ticker = ?
        """,
        (quantity, avg_cost, now, user_id, ticker),
    )
    if cursor.rowcount == 0:
        # No existing row — insert new one
        conn.execute(
            """
            INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (_uuid(), user_id, ticker, quantity, avg_cost, now),
        )


def delete_position(
    conn: sqlite3.Connection, ticker: str, user_id: str = "default"
) -> None:
    """Delete the position row for the given ticker."""
    conn.execute(
        "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
        (user_id, ticker.upper()),
    )


# --- Trades ---


def record_trade(
    conn: sqlite3.Connection,
    ticker: str,
    side: str,
    quantity: float,
    price: float,
    user_id: str = "default",
) -> dict:
    """Insert a trade record and return the full trade dict."""
    trade_id = _uuid()
    executed_at = _now()
    conn.execute(
        """
        INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (trade_id, user_id, ticker.upper(), side, quantity, price, executed_at),
    )
    return {
        "id": trade_id,
        "ticker": ticker.upper(),
        "side": side,
        "quantity": quantity,
        "price": price,
        "executed_at": executed_at,
    }


def get_trades(
    conn: sqlite3.Connection, limit: int = 50, user_id: str = "default"
) -> list[dict]:
    """Return the most recent trades, newest first."""
    rows = conn.execute(
        """
        SELECT id, ticker, side, quantity, price, executed_at
        FROM trades
        WHERE user_id = ?
        ORDER BY executed_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [dict(row) for row in rows]


# --- Portfolio Snapshots ---


def record_portfolio_snapshot(
    conn: sqlite3.Connection, total_value: float, user_id: str = "default"
) -> None:
    """Insert a portfolio value snapshot."""
    conn.execute(
        """
        INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
        VALUES (?, ?, ?, ?)
        """,
        (_uuid(), user_id, total_value, _now()),
    )


def get_portfolio_history(
    conn: sqlite3.Connection, user_id: str = "default"
) -> list[dict]:
    """Return all portfolio snapshots in chronological order (oldest first)."""
    rows = conn.execute(
        """
        SELECT total_value, recorded_at
        FROM portfolio_snapshots
        WHERE user_id = ?
        ORDER BY recorded_at ASC
        """,
        (user_id,),
    ).fetchall()
    return [dict(row) for row in rows]


# --- Chat ---


def add_chat_message(
    conn: sqlite3.Connection,
    role: str,
    content: str,
    actions: dict | None = None,
    user_id: str = "default",
) -> dict:
    """Insert a chat message. actions dict is serialized to JSON string."""
    message_id = _uuid()
    created_at = _now()
    actions_json = json.dumps(actions) if actions is not None else None
    conn.execute(
        """
        INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (message_id, user_id, role, content, actions_json, created_at),
    )
    return {
        "id": message_id,
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": created_at,
    }


def get_chat_history(
    conn: sqlite3.Connection, limit: int = 20, user_id: str = "default"
) -> list[dict]:
    """Return the most recent `limit` messages in chronological order (oldest first)."""
    rows = conn.execute(
        """
        SELECT id, role, content, actions, created_at
        FROM chat_messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    messages = []
    for row in rows:
        msg = dict(row)
        msg["actions"] = json.loads(msg["actions"]) if msg["actions"] else None
        messages.append(msg)
    # Reverse to return oldest-first for LLM context
    messages.reverse()
    return messages
