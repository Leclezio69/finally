import json
import os
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

LLM_MOCK = os.environ.get("LLM_MOCK", "false").lower() == "true"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

MOCK_RESPONSE = {
    "message": "I'm FinAlly, your AI trading assistant! I can analyze your portfolio and execute trades. How can I help you today?",
    "trades": [],
    "watchlist_changes": [],
}

SYSTEM_PROMPT = """You are FinAlly, an AI trading assistant for a simulated trading workstation.

You can:
- Analyze the user's portfolio composition, concentration risk, and P&L
- Suggest and execute trades (market orders, instant fill, simulated money)
- Add or remove tickers from the watchlist
- Provide market insights and trading recommendations

Always be concise and data-driven. Use the portfolio context provided.
When the user asks you to buy/sell something or manage their watchlist, include the appropriate action in your response.

IMPORTANT: You must respond with valid JSON matching this exact schema:
{
  "message": "Your response to the user (string, required)",
  "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10}],
  "watchlist_changes": [{"ticker": "PYPL", "action": "add"}]
}
trades and watchlist_changes can be empty arrays. All tickers must be uppercase."""


class TradeAction(BaseModel):
    ticker: str
    side: str
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: str


class LLMResponse(BaseModel):
    message: str
    trades: list[TradeAction] = []
    watchlist_changes: list[WatchlistChange] = []


def _build_portfolio_context_text(portfolio_context: dict) -> str:
    """Format portfolio context as readable text for the LLM."""
    lines = [
        "PORTFOLIO CONTEXT:",
        f"Cash balance: ${portfolio_context.get('cash_balance', 0):.2f}",
        f"Total portfolio value: ${portfolio_context.get('total_value', 0):.2f}",
    ]

    positions = portfolio_context.get("positions", [])
    if positions:
        lines.append("\nCurrent positions:")
        for p in positions:
            pnl = p.get("unrealized_pnl", 0)
            pct = p.get("pnl_percent", 0)
            lines.append(
                f"  {p['ticker']}: {p['quantity']} shares @ avg ${p['avg_cost']:.2f}, "
                f"current ${p.get('current_price', 0):.2f}, P&L ${pnl:.2f} ({pct:+.1f}%)"
            )
    else:
        lines.append("\nNo open positions.")

    watchlist = portfolio_context.get("watchlist", [])
    if watchlist:
        lines.append("\nWatchlist prices:")
        for w in watchlist:
            lines.append(f"  {w['ticker']}: ${w.get('price', 0):.2f} ({w.get('change_percent', 0):+.2f}%)")

    return "\n".join(lines)


async def chat_with_llm(
    message: str,
    portfolio_context: dict,
    history: list[dict],
) -> dict:
    """
    Call the LLM and return structured response.

    Args:
        message: User's message
        portfolio_context: {cash_balance, total_value, positions: [...], watchlist: [...]}
        history: List of {"role": "user"|"assistant", "content": str} — last 20 messages

    Returns:
        {"message": str, "trades": [...], "watchlist_changes": [...]}
    """
    if LLM_MOCK:
        return MOCK_RESPONSE.copy()

    try:
        from litellm import acompletion

        portfolio_text = _build_portfolio_context_text(portfolio_context)
        system_message = f"{SYSTEM_PROMPT}\n\n{portfolio_text}"

        messages = [{"role": "system", "content": system_message}]

        # Add conversation history
        for h in history:
            messages.append({"role": h["role"], "content": h["content"]})

        # Add current user message
        messages.append({"role": "user", "content": message})

        response = await acompletion(
            model=MODEL,
            messages=messages,
            api_key=OPENROUTER_API_KEY,
            response_format=LLMResponse,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )

        raw = response.choices[0].message.content
        return _parse_response(raw)

    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return {
            "message": "I'm having trouble connecting right now. Please try again in a moment.",
            "trades": [],
            "watchlist_changes": [],
        }


def _parse_response(raw: str) -> dict:
    """Parse LLM JSON response with fallback."""
    try:
        data = json.loads(raw)
        return {
            "message": str(data.get("message", "I'm not sure how to respond to that.")),
            "trades": _validate_trades(data.get("trades", [])),
            "watchlist_changes": _validate_watchlist_changes(data.get("watchlist_changes", [])),
        }
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Failed to parse LLM response as JSON: {e}. Raw: {raw[:200]}")
        return {
            "message": raw if raw else "I encountered an error processing your request.",
            "trades": [],
            "watchlist_changes": [],
        }


def _validate_trades(trades: list) -> list:
    """Validate and normalize trade entries from LLM."""
    valid = []
    if not isinstance(trades, list):
        return valid
    for t in trades:
        if not isinstance(t, dict):
            continue
        ticker = str(t.get("ticker", "")).upper().strip()
        side = str(t.get("side", "")).lower().strip()
        try:
            quantity = float(t.get("quantity", 0))
        except (TypeError, ValueError):
            continue
        if ticker and side in ("buy", "sell") and quantity > 0:
            valid.append({"ticker": ticker, "side": side, "quantity": quantity})
    return valid


def _validate_watchlist_changes(changes: list) -> list:
    """Validate and normalize watchlist change entries from LLM."""
    valid = []
    if not isinstance(changes, list):
        return valid
    for c in changes:
        if not isinstance(c, dict):
            continue
        ticker = str(c.get("ticker", "")).upper().strip()
        action = str(c.get("action", "")).lower().strip()
        if ticker and action in ("add", "remove"):
            valid.append({"ticker": ticker, "action": action})
    return valid
