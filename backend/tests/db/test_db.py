"""Unit tests for the database layer."""

import sqlite3
import tempfile
import os
import pytest

from app.db.init import init_db, get_db_connection, DEFAULT_TICKERS
from app.db.queries import (
    get_user,
    update_cash_balance,
    get_watchlist,
    add_to_watchlist,
    remove_from_watchlist,
    get_positions,
    get_position,
    upsert_position,
    delete_position,
    record_trade,
    get_trades,
    record_portfolio_snapshot,
    get_portfolio_history,
    add_chat_message,
    get_chat_history,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_path(tmp_path):
    """Return a path to a fresh temporary SQLite database."""
    path = str(tmp_path / "test_finally.db")
    init_db(db_path=path)
    return path


@pytest.fixture
def conn(db_path):
    """Open a connection to the test database (manual commit control)."""
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    yield connection
    connection.commit()
    connection.close()


# ---------------------------------------------------------------------------
# init_db tests
# ---------------------------------------------------------------------------


def test_init_db_creates_all_tables(db_path):
    """init_db creates all 6 expected tables."""
    connection = sqlite3.connect(db_path)
    tables = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    connection.close()
    expected = {
        "users_profile",
        "watchlist",
        "positions",
        "trades",
        "portfolio_snapshots",
        "chat_messages",
    }
    assert expected.issubset(tables)


def test_init_db_seeds_default_user(db_path):
    """init_db seeds the default user with $10,000 cash."""
    connection = sqlite3.connect(db_path)
    row = connection.execute(
        "SELECT id, cash_balance FROM users_profile WHERE id = 'default'"
    ).fetchone()
    connection.close()
    assert row is not None
    assert row[0] == "default"
    assert row[1] == 10000.0


def test_init_db_seeds_watchlist(db_path):
    """init_db seeds all 10 default tickers."""
    connection = sqlite3.connect(db_path)
    rows = connection.execute(
        "SELECT ticker FROM watchlist WHERE user_id = 'default'"
    ).fetchall()
    connection.close()
    tickers = {row[0] for row in rows}
    assert tickers == set(DEFAULT_TICKERS)


def test_init_db_is_idempotent(db_path):
    """Calling init_db twice does not duplicate data."""
    init_db(db_path=db_path)  # call a second time
    connection = sqlite3.connect(db_path)
    user_count = connection.execute(
        "SELECT COUNT(*) FROM users_profile WHERE id = 'default'"
    ).fetchone()[0]
    watchlist_count = connection.execute(
        "SELECT COUNT(*) FROM watchlist WHERE user_id = 'default'"
    ).fetchone()[0]
    connection.close()
    assert user_count == 1
    assert watchlist_count == len(DEFAULT_TICKERS)


# ---------------------------------------------------------------------------
# get_db_connection tests
# ---------------------------------------------------------------------------


def test_get_db_connection_yields_connection(db_path):
    """get_db_connection provides a working sqlite3 connection."""
    with get_db_connection(db_path=db_path) as c:
        assert isinstance(c, sqlite3.Connection)
        row = c.execute("SELECT id FROM users_profile WHERE id = 'default'").fetchone()
        assert row is not None


# ---------------------------------------------------------------------------
# User / cash balance tests
# ---------------------------------------------------------------------------


def test_get_user_returns_default_user(conn):
    user = get_user(conn)
    assert user is not None
    assert user["id"] == "default"
    assert user["cash_balance"] == 10000.0


def test_get_user_returns_none_for_missing(conn):
    assert get_user(conn, user_id="nonexistent") is None


def test_update_cash_balance_add(conn):
    new_balance = update_cash_balance(conn, 500.0)
    assert new_balance == 10500.0


def test_update_cash_balance_subtract(conn):
    new_balance = update_cash_balance(conn, -200.0)
    assert new_balance == 9800.0


def test_update_cash_balance_multiple(conn):
    update_cash_balance(conn, -1000.0)
    new_balance = update_cash_balance(conn, 250.0)
    assert abs(new_balance - 9250.0) < 0.001


# ---------------------------------------------------------------------------
# Watchlist tests
# ---------------------------------------------------------------------------


def test_get_watchlist_returns_seeded_tickers(conn):
    wl = get_watchlist(conn)
    tickers = {entry["ticker"] for entry in wl}
    assert tickers == set(DEFAULT_TICKERS)


def test_add_to_watchlist_returns_entry(conn):
    result = add_to_watchlist(conn, "PYPL")
    assert result["ticker"] == "PYPL"
    assert "id" in result
    assert "added_at" in result


def test_add_to_watchlist_normalizes_to_uppercase(conn):
    result = add_to_watchlist(conn, "tsla_new")
    assert result["ticker"] == "TSLA_NEW"


def test_add_to_watchlist_raises_on_duplicate(conn):
    with pytest.raises(ValueError, match="already in the watchlist"):
        add_to_watchlist(conn, "AAPL")  # AAPL is already seeded


def test_remove_from_watchlist_returns_true(conn):
    removed = remove_from_watchlist(conn, "AAPL")
    assert removed is True
    wl = get_watchlist(conn)
    tickers = {e["ticker"] for e in wl}
    assert "AAPL" not in tickers


def test_remove_from_watchlist_returns_false_when_not_found(conn):
    removed = remove_from_watchlist(conn, "XYZ_MISSING")
    assert removed is False


def test_get_watchlist_ordered_by_added_at(conn):
    # Add a ticker and verify ordering is maintained
    add_to_watchlist(conn, "NEWT")
    wl = get_watchlist(conn)
    timestamps = [e["added_at"] for e in wl]
    assert timestamps == sorted(timestamps)


# ---------------------------------------------------------------------------
# Positions tests
# ---------------------------------------------------------------------------


def test_get_positions_empty_initially(conn):
    assert get_positions(conn) == []


def test_upsert_position_inserts_new(conn):
    upsert_position(conn, "AAPL", 10.0, 150.0)
    pos = get_position(conn, "AAPL")
    assert pos is not None
    assert pos["ticker"] == "AAPL"
    assert pos["quantity"] == 10.0
    assert pos["avg_cost"] == 150.0


def test_upsert_position_updates_existing(conn):
    upsert_position(conn, "AAPL", 10.0, 150.0)
    upsert_position(conn, "AAPL", 20.0, 160.0)
    pos = get_position(conn, "AAPL")
    assert pos["quantity"] == 20.0
    assert pos["avg_cost"] == 160.0


def test_upsert_position_zero_quantity_deletes(conn):
    upsert_position(conn, "AAPL", 10.0, 150.0)
    upsert_position(conn, "AAPL", 0.0, 150.0)
    assert get_position(conn, "AAPL") is None


def test_upsert_position_negative_quantity_deletes(conn):
    upsert_position(conn, "AAPL", 5.0, 100.0)
    upsert_position(conn, "AAPL", -1.0, 100.0)
    assert get_position(conn, "AAPL") is None


def test_delete_position(conn):
    upsert_position(conn, "MSFT", 5.0, 300.0)
    delete_position(conn, "MSFT")
    assert get_position(conn, "MSFT") is None


def test_get_positions_ordered_by_ticker(conn):
    upsert_position(conn, "TSLA", 1.0, 200.0)
    upsert_position(conn, "AAPL", 2.0, 150.0)
    upsert_position(conn, "MSFT", 3.0, 300.0)
    positions = get_positions(conn)
    tickers = [p["ticker"] for p in positions]
    assert tickers == sorted(tickers)


def test_upsert_position_preserves_existing_id(conn):
    upsert_position(conn, "AAPL", 10.0, 150.0)
    pos1 = get_position(conn, "AAPL")
    upsert_position(conn, "AAPL", 20.0, 160.0)
    pos2 = get_position(conn, "AAPL")
    assert pos1["id"] == pos2["id"]


# ---------------------------------------------------------------------------
# Trades tests
# ---------------------------------------------------------------------------


def test_record_trade_returns_dict(conn):
    trade = record_trade(conn, "AAPL", "buy", 10.0, 150.0)
    assert trade["ticker"] == "AAPL"
    assert trade["side"] == "buy"
    assert trade["quantity"] == 10.0
    assert trade["price"] == 150.0
    assert "id" in trade
    assert "executed_at" in trade


def test_get_trades_most_recent_first(conn):
    record_trade(conn, "AAPL", "buy", 5.0, 150.0)
    record_trade(conn, "MSFT", "sell", 3.0, 300.0)
    trades = get_trades(conn)
    assert len(trades) == 2
    # Most recent should be MSFT sell (inserted last)
    assert trades[0]["ticker"] == "MSFT"
    assert trades[1]["ticker"] == "AAPL"


def test_get_trades_limit(conn):
    for i in range(10):
        record_trade(conn, "AAPL", "buy", float(i + 1), 100.0 + i)
    trades = get_trades(conn, limit=3)
    assert len(trades) == 3


def test_get_trades_empty(conn):
    assert get_trades(conn) == []


# ---------------------------------------------------------------------------
# Portfolio snapshots tests
# ---------------------------------------------------------------------------


def test_record_portfolio_snapshot(conn):
    record_portfolio_snapshot(conn, 10500.0)
    history = get_portfolio_history(conn)
    assert len(history) == 1
    assert history[0]["total_value"] == 10500.0


def test_get_portfolio_history_ordered_asc(conn):
    record_portfolio_snapshot(conn, 10000.0)
    record_portfolio_snapshot(conn, 10500.0)
    record_portfolio_snapshot(conn, 9800.0)
    history = get_portfolio_history(conn)
    assert len(history) == 3
    timestamps = [h["recorded_at"] for h in history]
    assert timestamps == sorted(timestamps)


def test_get_portfolio_history_empty(conn):
    assert get_portfolio_history(conn) == []


# ---------------------------------------------------------------------------
# Chat message tests
# ---------------------------------------------------------------------------


def test_add_chat_message_without_actions(conn):
    msg = add_chat_message(conn, "user", "Hello!")
    assert msg["role"] == "user"
    assert msg["content"] == "Hello!"
    assert msg["actions"] is None
    assert "id" in msg
    assert "created_at" in msg


def test_add_chat_message_with_actions(conn):
    actions = {"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}]}
    msg = add_chat_message(conn, "assistant", "Buying AAPL for you.", actions=actions)
    assert msg["actions"] == actions


def test_get_chat_history_returns_chronological_order(conn):
    add_chat_message(conn, "user", "First message")
    add_chat_message(conn, "assistant", "Second message")
    add_chat_message(conn, "user", "Third message")
    history = get_chat_history(conn)
    assert len(history) == 3
    assert history[0]["content"] == "First message"
    assert history[1]["content"] == "Second message"
    assert history[2]["content"] == "Third message"


def test_get_chat_history_limit(conn):
    for i in range(25):
        add_chat_message(conn, "user", f"Message {i}")
    history = get_chat_history(conn, limit=20)
    assert len(history) == 20
    # Should be the 20 most recent, in chronological order
    assert history[-1]["content"] == "Message 24"
    assert history[0]["content"] == "Message 5"


def test_get_chat_history_deserializes_actions(conn):
    actions = {"watchlist_changes": [{"ticker": "PYPL", "action": "add"}]}
    add_chat_message(conn, "assistant", "Added PYPL.", actions=actions)
    history = get_chat_history(conn)
    assert history[-1]["actions"] == actions


def test_get_chat_history_empty(conn):
    assert get_chat_history(conn) == []
