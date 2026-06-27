"""Unit tests for the FinAlly API routes.

All DB and LLM dependencies are mocked so these tests run without a database
or LLM API key.  Market data state is injected directly via app.state.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.health import router as health_router
from app.api.watchlist import router as watchlist_router
from app.api.portfolio import router as portfolio_router
from app.api.trades import router as trades_router
from app.api.chat import router as chat_router


# ---------------------------------------------------------------------------
# Test app factory — no lifespan so no DB / market data startup needed
# ---------------------------------------------------------------------------


def make_test_app(
    price_cache=None,
    market_source=None,
    db_path=":memory:",
) -> FastAPI:
    """Create a minimal FastAPI app with mocked state for unit tests."""
    test_app = FastAPI()
    test_app.include_router(health_router, prefix="/api")
    test_app.include_router(watchlist_router, prefix="/api")
    test_app.include_router(portfolio_router, prefix="/api")
    test_app.include_router(trades_router, prefix="/api")
    test_app.include_router(chat_router, prefix="/api")

    test_app.state.price_cache = price_cache or MagicMock()
    test_app.state.market_source = market_source or AsyncMock()
    test_app.state.db_path = db_path
    return test_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def price_cache():
    cache = MagicMock()
    cache.get.return_value = None
    cache.get_price.return_value = None
    return cache


@pytest.fixture()
def market_source():
    source = AsyncMock()
    return source


@pytest.fixture()
def client(price_cache, market_source):
    app = make_test_app(price_cache=price_cache, market_source=market_source)
    return TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "timestamp" in body


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------

WATCHLIST_ROWS = [
    {"id": "uuid-1", "ticker": "AAPL", "added_at": "2024-01-01T00:00:00+00:00"},
    {"id": "uuid-2", "ticker": "GOOGL", "added_at": "2024-01-01T00:00:00+00:00"},
]


class TestWatchlist:
    def test_list_watchlist_empty(self, client):
        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.get_watchlist", return_value=[]):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/watchlist")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_watchlist_with_items(self, client, price_cache):
        mock_update = MagicMock()
        mock_update.price = 190.0
        mock_update.previous_price = 189.0
        mock_update.change_percent = 0.53
        mock_update.direction = "up"
        price_cache.get.return_value = mock_update

        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.get_watchlist", return_value=WATCHLIST_ROWS):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/watchlist")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["ticker"] == "AAPL"
        assert data[0]["price"] == 190.0

    def test_add_ticker_success(self, client, market_source):
        new_entry = {"id": "uuid-3", "ticker": "TSLA", "added_at": "2024-01-01T00:00:00+00:00"}
        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.add_to_watchlist", return_value=new_entry):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/watchlist", json={"ticker": "tsla"})

        assert resp.status_code == 201
        assert resp.json()["ticker"] == "TSLA"
        market_source.add_ticker.assert_called_once_with("TSLA")

    def test_add_ticker_duplicate(self, client):
        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.add_to_watchlist", side_effect=ValueError("duplicate")):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/watchlist", json={"ticker": "AAPL"})

        assert resp.status_code == 409

    def test_remove_ticker_success(self, client, market_source):
        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.remove_from_watchlist", return_value=True):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.delete("/api/watchlist/AAPL")

        assert resp.status_code == 200
        assert resp.json()["removed"] is True
        market_source.remove_ticker.assert_called_once_with("AAPL")

    def test_remove_ticker_not_found(self, client):
        with patch("app.api.watchlist.get_db_connection") as mock_conn, \
             patch("app.api.watchlist.remove_from_watchlist", return_value=False):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.delete("/api/watchlist/XYZ")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

USER_ROW = {"cash_balance": 10000.0}
POSITIONS_ROWS = [
    {"ticker": "AAPL", "quantity": 10.0, "avg_cost": 180.0, "updated_at": "2024-01-01"},
]


class TestPortfolio:
    def test_get_portfolio(self, client, price_cache):
        price_cache.get_price.return_value = 200.0

        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_user", return_value=USER_ROW), \
             patch("app.api.portfolio.get_positions", return_value=POSITIONS_ROWS):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/portfolio")

        assert resp.status_code == 200
        body = resp.json()
        assert body["cash_balance"] == 10000.0
        # 10000 cash + 10 shares * $200 = 12000
        assert body["total_value"] == 12000.0
        assert len(body["positions"]) == 1
        assert body["positions"][0]["ticker"] == "AAPL"
        # unrealized P&L: 10 * (200 - 180) = 200
        assert body["positions"][0]["unrealized_pnl"] == pytest.approx(200.0)

    def test_trade_buy_success(self, client, price_cache):
        price_cache.get_price.return_value = 150.0
        trade_record = {
            "id": "t1", "ticker": "MSFT", "side": "buy",
            "quantity": 5.0, "price": 150.0, "executed_at": "2024-01-01",
        }

        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_user", return_value={"cash_balance": 10000.0}), \
             patch("app.api.portfolio.get_position", return_value=None), \
             patch("app.api.portfolio.update_cash_balance", return_value=9250.0), \
             patch("app.api.portfolio.upsert_position"), \
             patch("app.api.portfolio.record_trade", return_value=trade_record), \
             patch("app.api.portfolio.get_positions", return_value=[]), \
             patch("app.api.portfolio.record_portfolio_snapshot"):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/portfolio/trade", json={
                "ticker": "MSFT", "quantity": 5.0, "side": "buy"
            })

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["trade"]["side"] == "buy"
        assert body["new_cash_balance"] == 9250.0

    def test_trade_buy_insufficient_funds(self, client, price_cache):
        price_cache.get_price.return_value = 500.0

        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_user", return_value={"cash_balance": 100.0}):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/portfolio/trade", json={
                "ticker": "AAPL", "quantity": 10.0, "side": "buy"
            })

        assert resp.status_code == 400
        assert "Insufficient funds" in resp.json()["detail"]

    def test_trade_sell_success(self, client, price_cache):
        price_cache.get_price.return_value = 200.0
        existing_pos = {"ticker": "AAPL", "quantity": 10.0, "avg_cost": 180.0}
        trade_record = {
            "id": "t2", "ticker": "AAPL", "side": "sell",
            "quantity": 5.0, "price": 200.0, "executed_at": "2024-01-01",
        }

        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_user", return_value={"cash_balance": 5000.0}), \
             patch("app.api.portfolio.get_position", return_value=existing_pos), \
             patch("app.api.portfolio.update_cash_balance", return_value=6000.0), \
             patch("app.api.portfolio.upsert_position"), \
             patch("app.api.portfolio.record_trade", return_value=trade_record), \
             patch("app.api.portfolio.get_positions", return_value=[]), \
             patch("app.api.portfolio.record_portfolio_snapshot"):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/portfolio/trade", json={
                "ticker": "AAPL", "quantity": 5.0, "side": "sell"
            })

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["trade"]["side"] == "sell"

    def test_trade_sell_insufficient_shares(self, client, price_cache):
        price_cache.get_price.return_value = 200.0
        existing_pos = {"ticker": "AAPL", "quantity": 2.0, "avg_cost": 180.0}

        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_user", return_value={"cash_balance": 5000.0}), \
             patch("app.api.portfolio.get_position", return_value=existing_pos):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.post("/api/portfolio/trade", json={
                "ticker": "AAPL", "quantity": 10.0, "side": "sell"
            })

        assert resp.status_code == 400
        assert "Insufficient shares" in resp.json()["detail"]

    def test_portfolio_history(self, client):
        history = [
            {"total_value": 10000.0, "recorded_at": "2024-01-01T00:00:00"},
            {"total_value": 10500.0, "recorded_at": "2024-01-01T00:00:10"},
        ]
        with patch("app.api.portfolio.get_db_connection") as mock_conn, \
             patch("app.api.portfolio.get_portfolio_history", return_value=history):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/portfolio/history")

        assert resp.status_code == 200
        assert len(resp.json()) == 2


# ---------------------------------------------------------------------------
# Trades
# ---------------------------------------------------------------------------


class TestTrades:
    def test_list_trades(self, client):
        trades = [
            {
                "id": "t1", "ticker": "AAPL", "side": "buy",
                "quantity": 10.0, "price": 180.0, "executed_at": "2024-01-01",
            }
        ]
        with patch("app.api.trades.get_db_connection") as mock_conn, \
             patch("app.api.trades.get_trades", return_value=trades):
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/trades")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["ticker"] == "AAPL"

    def test_list_trades_with_limit(self, client):
        with patch("app.api.trades.get_db_connection") as mock_conn, \
             patch("app.api.trades.get_trades", return_value=[]) as mock_get:
            mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock())
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            resp = client.get("/api/trades?limit=10")

        assert resp.status_code == 200
