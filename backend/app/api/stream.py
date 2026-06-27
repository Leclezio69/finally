"""SSE streaming endpoint — reads price_cache from app.state."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stream/prices")
async def stream_prices(request: Request) -> StreamingResponse:
    """SSE endpoint: emits one `price_update` event per ticker per tick."""
    price_cache = request.app.state.price_cache
    return StreamingResponse(
        _generate_events(price_cache, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _generate_events(price_cache, request: Request, interval: float = 0.5):
    yield "retry: 1000\n\n"

    last_version = -1
    client = request.client.host if request.client else "unknown"
    logger.info("SSE client connected: %s", client)

    try:
        while True:
            if await request.is_disconnected():
                logger.info("SSE client disconnected: %s", client)
                break

            current_version = price_cache.version
            if current_version != last_version:
                last_version = current_version
                prices = price_cache.get_all()
                for update in prices.values():
                    payload = json.dumps(update.to_dict())
                    yield f"event: price_update\ndata: {payload}\n\n"

            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("SSE stream cancelled for: %s", client)
