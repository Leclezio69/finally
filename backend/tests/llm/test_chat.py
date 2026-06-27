"""Unit tests for the LLM chat module."""

import json
import pytest
import app.llm.chat as chat_module
from app.llm.chat import (
    _build_portfolio_context_text,
    _parse_response,
    _validate_trades,
    _validate_watchlist_changes,
    chat_with_llm,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def portfolio_context():
    return {
        "cash_balance": 5000.0,
        "total_value": 12500.0,
        "positions": [
            {
                "ticker": "AAPL",
                "quantity": 10.0,
                "avg_cost": 180.0,
                "current_price": 195.0,
                "unrealized_pnl": 150.0,
                "pnl_percent": 8.33,
            },
            {
                "ticker": "TSLA",
                "quantity": 5.0,
                "avg_cost": 250.0,
                "current_price": 220.0,
                "unrealized_pnl": -150.0,
                "pnl_percent": -12.0,
            },
        ],
        "watchlist": [
            {"ticker": "AAPL", "price": 195.0, "change_percent": 0.77},
            {"ticker": "GOOGL", "price": 175.0, "change_percent": -0.32},
        ],
    }


@pytest.fixture
def empty_portfolio_context():
    return {
        "cash_balance": 10000.0,
        "total_value": 10000.0,
        "positions": [],
        "watchlist": [],
    }


@pytest.fixture
def sample_history():
    return [
        {"role": "user", "content": "What do you think of my portfolio?"},
        {"role": "assistant", "content": "Your portfolio looks well-diversified."},
    ]


# ---------------------------------------------------------------------------
# 1. Mock mode returns expected response structure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mock_mode_returns_expected_structure(monkeypatch):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("Hello", {}, [])

    assert isinstance(result, dict)
    assert "message" in result
    assert "trades" in result
    assert "watchlist_changes" in result
    assert isinstance(result["message"], str)
    assert isinstance(result["trades"], list)
    assert isinstance(result["watchlist_changes"], list)


@pytest.mark.asyncio
async def test_mock_mode_returns_deterministic_response(monkeypatch):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result1 = await chat_with_llm("Buy AAPL", {}, [])
    result2 = await chat_with_llm("Sell TSLA", {}, [])

    assert result1["message"] == result2["message"]
    assert result1["trades"] == result2["trades"] == []
    assert result1["watchlist_changes"] == result2["watchlist_changes"] == []


@pytest.mark.asyncio
async def test_mock_mode_does_not_call_llm(monkeypatch, portfolio_context, sample_history):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    called = []

    async def fake_acompletion(**kwargs):
        called.append(True)
        raise AssertionError("Should not reach real LLM in mock mode")

    # litellm may not be installed; patch at the module level regardless
    import unittest.mock as mock
    with mock.patch.dict("sys.modules", {"litellm": mock.MagicMock(acompletion=fake_acompletion)}):
        result = await chat_with_llm("Hello", portfolio_context, sample_history)

    assert not called
    assert "message" in result


# ---------------------------------------------------------------------------
# 2. _parse_response handles valid JSON correctly
# ---------------------------------------------------------------------------

def test_parse_response_valid_json():
    raw = json.dumps({
        "message": "Here is my analysis.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 5}],
        "watchlist_changes": [{"ticker": "MSFT", "action": "add"}],
    })
    result = _parse_response(raw)

    assert result["message"] == "Here is my analysis."
    assert len(result["trades"]) == 1
    assert result["trades"][0] == {"ticker": "AAPL", "side": "buy", "quantity": 5.0}
    assert len(result["watchlist_changes"]) == 1
    assert result["watchlist_changes"][0] == {"ticker": "MSFT", "action": "add"}


def test_parse_response_empty_arrays():
    raw = json.dumps({"message": "No actions needed.", "trades": [], "watchlist_changes": []})
    result = _parse_response(raw)

    assert result["message"] == "No actions needed."
    assert result["trades"] == []
    assert result["watchlist_changes"] == []


def test_parse_response_missing_optional_fields():
    raw = json.dumps({"message": "Just a message."})
    result = _parse_response(raw)

    assert result["message"] == "Just a message."
    assert result["trades"] == []
    assert result["watchlist_changes"] == []


def test_parse_response_message_coerced_to_string():
    raw = json.dumps({"message": 42})
    result = _parse_response(raw)
    assert result["message"] == "42"


# ---------------------------------------------------------------------------
# 3. _parse_response handles malformed JSON gracefully
# ---------------------------------------------------------------------------

def test_parse_response_malformed_json_returns_raw_text():
    raw = "This is not valid JSON at all."
    result = _parse_response(raw)

    assert result["message"] == raw
    assert result["trades"] == []
    assert result["watchlist_changes"] == []


def test_parse_response_empty_string():
    result = _parse_response("")

    assert result["message"] == "I encountered an error processing your request."
    assert result["trades"] == []
    assert result["watchlist_changes"] == []


def test_parse_response_partial_json():
    raw = '{"message": "incomplete...'
    result = _parse_response(raw)

    assert result["trades"] == []
    assert result["watchlist_changes"] == []
    # message should be the raw text since JSON failed
    assert result["message"] == raw


# ---------------------------------------------------------------------------
# 4. _validate_trades normalizes tickers, filters invalid entries
# ---------------------------------------------------------------------------

def test_validate_trades_normalizes_ticker_to_uppercase():
    trades = [{"ticker": "aapl", "side": "buy", "quantity": 10}]
    result = _validate_trades(trades)

    assert len(result) == 1
    assert result[0]["ticker"] == "AAPL"


def test_validate_trades_normalizes_side_to_lowercase():
    trades = [{"ticker": "AAPL", "side": "BUY", "quantity": 5}]
    result = _validate_trades(trades)

    assert len(result) == 1
    assert result[0]["side"] == "buy"


def test_validate_trades_filters_invalid_side():
    trades = [
        {"ticker": "AAPL", "side": "hold", "quantity": 10},
        {"ticker": "MSFT", "side": "buy", "quantity": 5},
    ]
    result = _validate_trades(trades)

    assert len(result) == 1
    assert result[0]["ticker"] == "MSFT"


def test_validate_trades_filters_negative_quantity():
    trades = [{"ticker": "AAPL", "side": "buy", "quantity": -5}]
    result = _validate_trades(trades)
    assert result == []


def test_validate_trades_filters_zero_quantity():
    trades = [{"ticker": "AAPL", "side": "sell", "quantity": 0}]
    result = _validate_trades(trades)
    assert result == []


def test_validate_trades_filters_non_dict_entries():
    trades = ["not a dict", None, 42, {"ticker": "AAPL", "side": "buy", "quantity": 1}]
    result = _validate_trades(trades)

    assert len(result) == 1
    assert result[0]["ticker"] == "AAPL"


def test_validate_trades_handles_non_list_input():
    result = _validate_trades(None)
    assert result == []

    result = _validate_trades("not a list")
    assert result == []


def test_validate_trades_coerces_quantity_to_float():
    trades = [{"ticker": "AAPL", "side": "buy", "quantity": "10.5"}]
    result = _validate_trades(trades)

    assert len(result) == 1
    assert result[0]["quantity"] == 10.5


def test_validate_trades_filters_non_numeric_quantity():
    trades = [{"ticker": "AAPL", "side": "buy", "quantity": "lots"}]
    result = _validate_trades(trades)
    assert result == []


def test_validate_trades_filters_missing_ticker():
    trades = [{"side": "buy", "quantity": 5}]
    result = _validate_trades(trades)
    # ticker becomes empty string after upper().strip()
    assert result == []


def test_validate_trades_multiple_valid():
    trades = [
        {"ticker": "aapl", "side": "BUY", "quantity": 10},
        {"ticker": "tsla", "side": "sell", "quantity": 3.5},
    ]
    result = _validate_trades(trades)

    assert len(result) == 2
    assert result[0] == {"ticker": "AAPL", "side": "buy", "quantity": 10.0}
    assert result[1] == {"ticker": "TSLA", "side": "sell", "quantity": 3.5}


# ---------------------------------------------------------------------------
# 5. _validate_watchlist_changes normalizes tickers, filters invalid actions
# ---------------------------------------------------------------------------

def test_validate_watchlist_changes_normalizes_ticker():
    changes = [{"ticker": "msft", "action": "add"}]
    result = _validate_watchlist_changes(changes)

    assert len(result) == 1
    assert result[0]["ticker"] == "MSFT"


def test_validate_watchlist_changes_normalizes_action_to_lowercase():
    changes = [{"ticker": "AAPL", "action": "ADD"}]
    result = _validate_watchlist_changes(changes)

    assert len(result) == 1
    assert result[0]["action"] == "add"


def test_validate_watchlist_changes_filters_invalid_action():
    changes = [
        {"ticker": "AAPL", "action": "watch"},
        {"ticker": "MSFT", "action": "remove"},
    ]
    result = _validate_watchlist_changes(changes)

    assert len(result) == 1
    assert result[0]["ticker"] == "MSFT"


def test_validate_watchlist_changes_handles_non_list():
    assert _validate_watchlist_changes(None) == []
    assert _validate_watchlist_changes({}) == []


def test_validate_watchlist_changes_filters_non_dict():
    changes = ["AAPL", None, {"ticker": "GOOGL", "action": "add"}]
    result = _validate_watchlist_changes(changes)

    assert len(result) == 1
    assert result[0]["ticker"] == "GOOGL"


def test_validate_watchlist_changes_filters_missing_ticker():
    changes = [{"action": "add"}]
    result = _validate_watchlist_changes(changes)
    assert result == []


def test_validate_watchlist_changes_both_actions():
    changes = [
        {"ticker": "nvda", "action": "add"},
        {"ticker": "META", "action": "REMOVE"},
    ]
    result = _validate_watchlist_changes(changes)

    assert len(result) == 2
    assert result[0] == {"ticker": "NVDA", "action": "add"}
    assert result[1] == {"ticker": "META", "action": "remove"}


# ---------------------------------------------------------------------------
# 6. _build_portfolio_context_text formats context correctly
# ---------------------------------------------------------------------------

def test_build_portfolio_context_text_includes_cash_and_total(portfolio_context):
    text = _build_portfolio_context_text(portfolio_context)

    assert "5000.00" in text
    assert "12500.00" in text
    assert "Cash balance" in text
    assert "Total portfolio value" in text


def test_build_portfolio_context_text_includes_positions(portfolio_context):
    text = _build_portfolio_context_text(portfolio_context)

    assert "AAPL" in text
    assert "TSLA" in text
    assert "195.00" in text  # current price of AAPL
    assert "150.00" in text  # P&L of AAPL
    assert "-150.00" in text  # P&L of TSLA


def test_build_portfolio_context_text_includes_watchlist(portfolio_context):
    text = _build_portfolio_context_text(portfolio_context)

    assert "GOOGL" in text
    assert "175.00" in text


def test_build_portfolio_context_text_no_positions(empty_portfolio_context):
    text = _build_portfolio_context_text(empty_portfolio_context)

    assert "No open positions" in text
    assert "10000.00" in text


def test_build_portfolio_context_text_no_watchlist(empty_portfolio_context):
    text = _build_portfolio_context_text(empty_portfolio_context)
    # No watchlist section should appear (empty list)
    assert "Watchlist prices" not in text


def test_build_portfolio_context_text_returns_string(portfolio_context):
    result = _build_portfolio_context_text(portfolio_context)
    assert isinstance(result, str)
    assert len(result) > 0


def test_build_portfolio_context_text_pnl_sign(portfolio_context):
    text = _build_portfolio_context_text(portfolio_context)
    # TSLA pnl_percent is -12.0, should show as -12.0%
    assert "-12.0%" in text
    # AAPL pnl_percent is +8.33, should show as +8.3%
    assert "+8.3%" in text


# ---------------------------------------------------------------------------
# 7. chat_with_llm in mock mode returns dict with required keys
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_with_llm_mock_returns_required_keys(monkeypatch, portfolio_context, sample_history):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("How is my portfolio?", portfolio_context, sample_history)

    assert isinstance(result, dict)
    required_keys = {"message", "trades", "watchlist_changes"}
    assert required_keys.issubset(result.keys())


@pytest.mark.asyncio
async def test_chat_with_llm_mock_message_is_nonempty_string(monkeypatch, portfolio_context, sample_history):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("Hello", portfolio_context, sample_history)

    assert isinstance(result["message"], str)
    assert len(result["message"]) > 0


@pytest.mark.asyncio
async def test_chat_with_llm_mock_trades_is_list(monkeypatch, portfolio_context, sample_history):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("Buy some AAPL", portfolio_context, sample_history)

    assert isinstance(result["trades"], list)


@pytest.mark.asyncio
async def test_chat_with_llm_mock_watchlist_changes_is_list(monkeypatch, portfolio_context, sample_history):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("Add NVDA to watchlist", portfolio_context, sample_history)

    assert isinstance(result["watchlist_changes"], list)


@pytest.mark.asyncio
async def test_chat_with_llm_mock_with_empty_context(monkeypatch):
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result = await chat_with_llm("Hello", {}, [])

    assert "message" in result
    assert "trades" in result
    assert "watchlist_changes" in result


@pytest.mark.asyncio
async def test_chat_with_llm_mock_returns_copy_not_reference(monkeypatch):
    """Each call returns an independent copy, not the shared MOCK_RESPONSE dict."""
    monkeypatch.setattr(chat_module, "LLM_MOCK", True)
    result1 = await chat_with_llm("Hello", {}, [])
    result2 = await chat_with_llm("World", {}, [])

    # Mutating one result should not affect the other or MOCK_RESPONSE
    result1["message"] = "mutated"
    assert result2["message"] != "mutated"
    assert chat_module.MOCK_RESPONSE["message"] != "mutated"
