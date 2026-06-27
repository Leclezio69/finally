"""Database layer public API."""

from app.db.init import get_db_connection, init_db
from app.db.queries import (
    add_chat_message,
    add_to_watchlist,
    delete_position,
    get_chat_history,
    get_portfolio_history,
    get_position,
    get_positions,
    get_trades,
    get_user,
    get_watchlist,
    record_portfolio_snapshot,
    record_trade,
    remove_from_watchlist,
    update_cash_balance,
    upsert_position,
)

__all__ = [
    "init_db",
    "get_db_connection",
    "get_user",
    "update_cash_balance",
    "get_watchlist",
    "add_to_watchlist",
    "remove_from_watchlist",
    "get_positions",
    "get_position",
    "upsert_position",
    "delete_position",
    "record_trade",
    "get_trades",
    "record_portfolio_snapshot",
    "get_portfolio_history",
    "add_chat_message",
    "get_chat_history",
]
