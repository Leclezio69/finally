"""Watchlist API endpoints."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import (
    add_to_watchlist,
    get_db_connection,
    get_watchlist,
    remove_from_watchlist,
)

router = APIRouter(tags=["watchlist"])


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("/watchlist")
async def list_watchlist(request: Request):
    price_cache = request.app.state.price_cache
    db_path = request.app.state.db_path

    with get_db_connection(db_path) as conn:
        items = get_watchlist(conn)

    result = []
    for item in items:
        ticker = item["ticker"]
        update = price_cache.get(ticker)
        result.append(
            {
                "ticker": ticker,
                "price": update.price if update else None,
                "previous_price": update.previous_price if update else None,
                "change_percent": update.change_percent if update else None,
                "direction": update.direction if update else None,
                "added_at": item["added_at"],
            }
        )
    return result


@router.post("/watchlist", status_code=201)
async def add_ticker(body: AddTickerRequest, request: Request):
    ticker = body.ticker.upper().strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker cannot be empty")

    db_path = request.app.state.db_path
    market_source = request.app.state.market_source

    with get_db_connection(db_path) as conn:
        try:
            entry = add_to_watchlist(conn, ticker)
        except ValueError:
            raise HTTPException(status_code=409, detail=f"{ticker} is already in watchlist")

    await market_source.add_ticker(ticker)
    return entry


@router.delete("/watchlist/{ticker}")
async def remove_ticker(ticker: str, request: Request):
    ticker = ticker.upper().strip()
    db_path = request.app.state.db_path
    market_source = request.app.state.market_source

    with get_db_connection(db_path) as conn:
        removed = remove_from_watchlist(conn, ticker)

    if not removed:
        raise HTTPException(status_code=404, detail=f"{ticker} not found in watchlist")

    await market_source.remove_ticker(ticker)
    return {"ticker": ticker, "removed": True}
