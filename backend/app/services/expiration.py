"""Background task that expires pending authorization requests past their expires_at."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import update

from app.database import AsyncSessionLocal
from app.models.database import AuthorizationRequest

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 30


async def expire_pending_requests() -> int:
    """Mark all overdue pending requests as expired. Returns count of rows updated."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            update(AuthorizationRequest)
            .where(
                AuthorizationRequest.status == "pending",
                AuthorizationRequest.expires_at <= datetime.now(timezone.utc),
            )
            .values(status="expired")
        )
        await db.commit()
        return result.rowcount


async def run_expiration_loop(interval: float = _INTERVAL_SECONDS) -> None:
    """Continuously expire overdue requests. Designed to run as an asyncio background task."""
    while True:
        try:
            expired = await expire_pending_requests()
            if expired:
                logger.info("Expired %d pending authorization request(s)", expired)
        except Exception:
            logger.exception("Error in expiration loop")
        await asyncio.sleep(interval)
