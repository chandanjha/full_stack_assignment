import logging

from redis.asyncio import Redis

from app.core.settings import settings

logger = logging.getLogger(__name__)

_redis_client: Redis | None = None


def get_redis_client() -> Redis | None:
    global _redis_client

    if not settings.REDIS_ENABLED:
        return None

    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=settings.REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS,
        )

    return _redis_client


async def close_redis_client() -> None:
    global _redis_client

    if _redis_client is None:
        return

    try:
        if hasattr(_redis_client, "aclose"):
            await _redis_client.aclose()
        else:
            await _redis_client.close()
    except Exception:
        logger.exception("Failed closing Redis client")
    finally:
        _redis_client = None
