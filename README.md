# FinAlly — AI Trading Workstation

An AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and includes an LLM chat assistant that can analyze positions and execute trades through natural language.

Built entirely by coding agents as a capstone project for an agentic AI coding course.

## Features

- **Live price streaming** with green/red flash animations via SSE
- **Simulated portfolio** — $10k virtual cash, market orders, instant fills
- **Portfolio visualizations** — heatmap, P&L chart, positions table
- **AI chat assistant** — analyzes holdings, suggests and auto-executes trades
- **Watchlist management** — manually or via AI
- **Dark terminal aesthetic** — Bloomberg-inspired layout

## Architecture

Single Docker container on port 8000:

- **Frontend**: Next.js (static export), TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python/uv), SSE streaming, SQLite
- **AI**: LiteLLM via OpenRouter (Cerebras inference) with structured outputs
- **Market data**: Built-in simulator (default) or Massive API (optional)

## Quick Start

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env

docker build -t finally .
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally

# Open http://localhost:8000
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI chat |
| `MASSIVE_API_KEY` | No | Massive API key for real market data; omit to use simulator |
| `LLM_MOCK` | No | Set `true` for mock LLM responses (testing) |

## License

See [LICENSE](LICENSE).
