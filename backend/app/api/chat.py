"""Chat API endpoint — LLM integration with auto-execution of trades and watchlist changes."""

import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.db import (
    add_chat_message,
    add_to_watchlist,
    get_chat_history,
    get_db_connection,
    get_position,
    get_positions,
    get_user,
    get_watchlist,
    record_portfolio_snapshot,
    record_trade,
    remove_from_watchlist,
    update_cash_balance,
    upsert_position,
)
from app.llm import chat_with_llm

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
async def chat(body: ChatRequest, request: Request):
    db_path = request.app.state.db_path
    price_cache = request.app.state.price_cache
    market_source = request.app.state.market_source

    # Build portfolio context for the LLM
    with get_db_connection(db_path) as conn:
        user = get_user(conn)
        positions = get_positions(conn)
        watchlist = get_watchlist(conn)
        history_rows = get_chat_history(conn, limit=20)

    cash = user["cash_balance"] if user else 0
    total_value = cash

    enriched_positions = []
    for pos in positions:
        current_price = price_cache.get_price(pos["ticker"]) or pos["avg_cost"]
        position_value = pos["quantity"] * current_price
        total_value += position_value
        cost_basis = pos["quantity"] * pos["avg_cost"]
        unrealized_pnl = position_value - cost_basis
        pnl_percent = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0
        enriched_positions.append(
            {
                "ticker": pos["ticker"],
                "quantity": pos["quantity"],
                "avg_cost": pos["avg_cost"],
                "current_price": current_price,
                "unrealized_pnl": unrealized_pnl,
                "pnl_percent": pnl_percent,
            }
        )

    watchlist_with_prices = []
    for w in watchlist:
        update = price_cache.get(w["ticker"])
        watchlist_with_prices.append(
            {
                "ticker": w["ticker"],
                "price": update.price if update else None,
                "change_percent": update.change_percent if update else None,
            }
        )

    portfolio_context = {
        "cash_balance": cash,
        "total_value": total_value,
        "positions": enriched_positions,
        "watchlist": watchlist_with_prices,
    }

    llm_history = [{"role": h["role"], "content": h["content"]} for h in history_rows]

    # Call LLM
    llm_response = await chat_with_llm(body.message, portfolio_context, llm_history)

    # Auto-execute trades from LLM response
    executed_trades = []
    trade_errors = []

    for trade in llm_response.get("trades", []):
        ticker = trade["ticker"].upper()
        side = trade["side"]
        quantity = float(trade["quantity"])

        if quantity <= 0:
            trade_errors.append(f"Invalid quantity {quantity} for {ticker}")
            continue
        if side not in ("buy", "sell"):
            trade_errors.append(f"Invalid side '{side}' for {ticker}")
            continue

        current_price = price_cache.get_price(ticker)
        if current_price is None:
            trade_errors.append(
                f"Cannot execute {side} {quantity} {ticker}: price not available"
            )
            continue

        try:
            with get_db_connection(db_path) as conn:
                user = get_user(conn)
                cash = user["cash_balance"]

                if side == "buy":
                    cost = quantity * current_price
                    if cash < cost:
                        trade_errors.append(
                            f"Insufficient funds for {side} {quantity} {ticker}: need ${cost:.2f}"
                        )
                        continue
                    new_cash = update_cash_balance(conn, -cost)
                    existing = get_position(conn, ticker)
                    if existing:
                        total_qty = existing["quantity"] + quantity
                        new_avg = (
                            existing["quantity"] * existing["avg_cost"]
                            + quantity * current_price
                        ) / total_qty
                        upsert_position(conn, ticker, total_qty, new_avg)
                    else:
                        upsert_position(conn, ticker, quantity, current_price)
                else:  # sell
                    existing = get_position(conn, ticker)
                    if not existing or existing["quantity"] < quantity:
                        avail = existing["quantity"] if existing else 0
                        trade_errors.append(
                            f"Insufficient shares for {side} {quantity} {ticker}: have {avail}"
                        )
                        continue
                    proceeds = quantity * current_price
                    new_cash = update_cash_balance(conn, proceeds)
                    new_qty = existing["quantity"] - quantity
                    upsert_position(conn, ticker, new_qty, existing["avg_cost"])

                t = record_trade(conn, ticker, side, quantity, current_price)
                executed_trades.append(t)
        except Exception as e:
            logger.exception("Trade error for %s", ticker)
            trade_errors.append(f"Trade error for {ticker}: {str(e)}")

    # Auto-execute watchlist changes from LLM response
    watchlist_results = []
    for change in llm_response.get("watchlist_changes", []):
        ticker = change["ticker"].upper()
        action = change["action"]
        try:
            with get_db_connection(db_path) as conn:
                if action == "add":
                    try:
                        add_to_watchlist(conn, ticker)
                        await market_source.add_ticker(ticker)
                        watchlist_results.append({"ticker": ticker, "action": "added"})
                    except ValueError:
                        watchlist_results.append(
                            {"ticker": ticker, "action": "already_in_watchlist"}
                        )
                elif action == "remove":
                    removed = remove_from_watchlist(conn, ticker)
                    if removed:
                        await market_source.remove_ticker(ticker)
                        watchlist_results.append({"ticker": ticker, "action": "removed"})
                    else:
                        watchlist_results.append({"ticker": ticker, "action": "not_found"})
                else:
                    watchlist_results.append(
                        {"ticker": ticker, "action": f"unknown_action:{action}"}
                    )
        except Exception as e:
            logger.exception("Watchlist error for %s", ticker)
            watchlist_results.append({"ticker": ticker, "action": f"error: {str(e)}"})

    # Build actions summary for storage
    actions = None
    if executed_trades or trade_errors or watchlist_results:
        actions = {
            "executed_trades": executed_trades,
            "trade_errors": trade_errors,
            "watchlist_changes": watchlist_results,
        }

    # Persist messages
    with get_db_connection(db_path) as conn:
        add_chat_message(conn, "user", body.message)
        add_chat_message(conn, "assistant", llm_response["message"], actions)

    return {
        "message": llm_response["message"],
        "trades": llm_response.get("trades", []),
        "watchlist_changes": llm_response.get("watchlist_changes", []),
        "executed_trades": executed_trades,
        "watchlist_results": watchlist_results,
        "errors": trade_errors,
    }
