"""Portfolio API endpoints: positions, trades, and portfolio history."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import (
    get_db_connection,
    get_portfolio_history,
    get_position,
    get_positions,
    get_user,
    record_portfolio_snapshot,
    record_trade,
    update_cash_balance,
    upsert_position,
)

router = APIRouter(tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str  # "buy" or "sell"


@router.get("/portfolio")
async def get_portfolio(request: Request):
    db_path = request.app.state.db_path
    price_cache = request.app.state.price_cache

    with get_db_connection(db_path) as conn:
        user = get_user(conn)
        positions = get_positions(conn)

    if user is None:
        raise HTTPException(status_code=500, detail="User profile not found")

    cash = user["cash_balance"]
    total_value = cash
    enriched_positions = []

    for pos in positions:
        ticker = pos["ticker"]
        current_price = price_cache.get_price(ticker)
        if current_price is None:
            current_price = pos["avg_cost"]  # fallback

        position_value = pos["quantity"] * current_price
        total_value += position_value
        cost_basis = pos["quantity"] * pos["avg_cost"]
        unrealized_pnl = position_value - cost_basis
        pnl_percent = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0

        enriched_positions.append(
            {
                "ticker": ticker,
                "quantity": pos["quantity"],
                "avg_cost": pos["avg_cost"],
                "current_price": current_price,
                "unrealized_pnl": unrealized_pnl,
                "pnl_percent": pnl_percent,
            }
        )

    unrealized_pnl_total = sum(p["unrealized_pnl"] for p in enriched_positions)

    return {
        "cash_balance": cash,
        "total_value": total_value,
        "unrealized_pnl": unrealized_pnl_total,
        "positions": enriched_positions,
    }


@router.post("/portfolio/trade")
async def execute_trade(body: TradeRequest, request: Request):
    ticker = body.ticker.upper().strip()
    quantity = body.quantity
    side = body.side.lower()

    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'")

    db_path = request.app.state.db_path
    price_cache = request.app.state.price_cache

    current_price = price_cache.get_price(ticker)
    if current_price is None:
        raise HTTPException(
            status_code=400,
            detail=f"{ticker} price not available. Add it to watchlist first.",
        )

    with get_db_connection(db_path) as conn:
        user = get_user(conn)
        if user is None:
            raise HTTPException(status_code=500, detail="User profile not found")

        cash = user["cash_balance"]

        if side == "buy":
            cost = quantity * current_price
            if cash < cost:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient funds. Need ${cost:.2f}, have ${cash:.2f}",
                )
            new_cash = update_cash_balance(conn, -cost)
            existing = get_position(conn, ticker)
            if existing:
                total_qty = existing["quantity"] + quantity
                new_avg = (
                    existing["quantity"] * existing["avg_cost"] + quantity * current_price
                ) / total_qty
                upsert_position(conn, ticker, total_qty, new_avg)
            else:
                upsert_position(conn, ticker, quantity, current_price)

        else:  # sell
            existing = get_position(conn, ticker)
            if existing is None or existing["quantity"] < quantity:
                available = existing["quantity"] if existing else 0
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient shares. Need {quantity}, have {available}",
                )
            proceeds = quantity * current_price
            new_cash = update_cash_balance(conn, proceeds)
            new_qty = existing["quantity"] - quantity
            upsert_position(conn, ticker, new_qty, existing["avg_cost"])

        trade = record_trade(conn, ticker, side, quantity, current_price)

        # Record portfolio snapshot immediately after trade
        positions = get_positions(conn)
        total = new_cash
        for pos in positions:
            p = price_cache.get_price(pos["ticker"])
            if p:
                total += pos["quantity"] * p
        record_portfolio_snapshot(conn, total)

    return {
        "success": True,
        "trade": trade,
        "new_cash_balance": new_cash,
    }


@router.get("/portfolio/history")
async def portfolio_history(request: Request):
    db_path = request.app.state.db_path
    with get_db_connection(db_path) as conn:
        history = get_portfolio_history(conn)
    return history
