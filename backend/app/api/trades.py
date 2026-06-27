"""Trade history API endpoint."""

from fastapi import APIRouter, Query, Request

from app.db import get_db_connection, get_trades

router = APIRouter(tags=["trades"])


@router.get("/trades")
async def list_trades(request: Request, limit: int = Query(default=50, ge=1, le=500)):
    db_path = request.app.state.db_path
    with get_db_connection(db_path) as conn:
        trades = get_trades(conn, limit=limit)
    return trades
