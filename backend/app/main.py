"""FinAlly FastAPI application entry point."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.portfolio import router as portfolio_router
from app.api.stream import router as stream_router
from app.api.trades import router as trades_router
from app.api.watchlist import router as watchlist_router
from app.db import get_db_connection, get_watchlist, init_db
from app.market import PriceCache, create_market_data_source

logger = logging.getLogger(__name__)

DB_PATH = os.environ.get("DB_PATH", "/app/db/finally.db")
STATIC_DIR = os.environ.get("STATIC_DIR", "/app/static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown logic."""
    # ---- Startup ----
    init_db(DB_PATH)

    price_cache = PriceCache()
    market_source = create_market_data_source(price_cache)

    # Load initial watchlist from DB so the market data source starts tracking them
    with get_db_connection(DB_PATH) as conn:
        watchlist = get_watchlist(conn)
    initial_tickers = [w["ticker"] for w in watchlist]

    await market_source.start(initial_tickers)

    # Store shared state
    app.state.price_cache = price_cache
    app.state.market_source = market_source
    app.state.db_path = DB_PATH

    # Start background portfolio snapshot task
    snapshot_task = asyncio.create_task(_portfolio_snapshot_loop(app))

    yield  # App is running

    # ---- Shutdown ----
    snapshot_task.cancel()
    try:
        await snapshot_task
    except asyncio.CancelledError:
        pass
    await market_source.stop()


async def _portfolio_snapshot_loop(app: FastAPI):
    """Record total portfolio value every 10 seconds."""
    from app.db import get_positions, get_user, record_portfolio_snapshot

    while True:
        await asyncio.sleep(10)
        try:
            db_path = app.state.db_path
            price_cache = app.state.price_cache
            with get_db_connection(db_path) as conn:
                user = get_user(conn)
                if user is None:
                    continue
                positions = get_positions(conn)
                cash = user["cash_balance"]
                total = cash
                for pos in positions:
                    price = price_cache.get_price(pos["ticker"])
                    if price is not None:
                        total += pos["quantity"] * price
                record_portfolio_snapshot(conn, total)
        except Exception:
            logger.exception("Portfolio snapshot error")


def create_app() -> FastAPI:
    app = FastAPI(title="FinAlly", version="0.1.0", lifespan=lifespan)

    # API routes — all registered before the static files mount
    app.include_router(health_router, prefix="/api")
    app.include_router(stream_router, prefix="/api")
    app.include_router(watchlist_router, prefix="/api")
    app.include_router(portfolio_router, prefix="/api")
    app.include_router(trades_router, prefix="/api")
    app.include_router(chat_router, prefix="/api")

    # Serve Next.js static export at root (only if the build output exists)
    static_path = Path(STATIC_DIR)
    if static_path.exists():
        app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

    return app


app = create_app()
