import json
import logging
from uuid import UUID

from pydantic import ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.settings import settings
from app.schemas.library import RecommendationPublic

logger = logging.getLogger(__name__)


class RecommendationCacheRepository:
    _CACHE_KEY_PREFIX = "luminalib:v1"

    def __init__(self, redis_client: Redis | None):
        self.redis_client = redis_client

    @classmethod
    def _key_for_user(cls, user_id: UUID) -> str:
        return f"{cls._CACHE_KEY_PREFIX}:user:{user_id}:recommendations"

    async def get_user_recommendations(
        self,
        user_id: UUID,
        limit: int,
    ) -> list[RecommendationPublic] | None:
        if self.redis_client is None:
            return None

        try:
            cached_payload = await self.redis_client.hget(self._key_for_user(user_id), str(limit))
            if not cached_payload:
                return None

            raw_items = json.loads(cached_payload)
            if not isinstance(raw_items, list):
                return None

            return [RecommendationPublic.model_validate(item) for item in raw_items]
        except (RedisError, json.JSONDecodeError, ValidationError, ValueError, TypeError):
            logger.exception(
                "Failed reading recommendation cache for user_id=%s and limit=%s",
                user_id,
                limit,
            )
            return None

    async def set_user_recommendations(
        self,
        user_id: UUID,
        limit: int,
        recommendations: list[RecommendationPublic],
    ) -> None:
        if self.redis_client is None:
            return

        serialized_recommendations = [
            recommendation.model_dump(mode="json") for recommendation in recommendations
        ]
        cache_key = self._key_for_user(user_id)
        try:
            await self.redis_client.hset(
                cache_key,
                str(limit),
                json.dumps(serialized_recommendations, separators=(",", ":")),
            )
            await self.redis_client.expire(cache_key, settings.RECOMMENDATION_CACHE_TTL_SECONDS)
        except (RedisError, ValueError, TypeError):
            logger.exception(
                "Failed writing recommendation cache for user_id=%s and limit=%s",
                user_id,
                limit,
            )

    async def invalidate_user_recommendations(self, user_id: UUID) -> None:
        if self.redis_client is None:
            return

        try:
            await self.redis_client.delete(self._key_for_user(user_id))
        except RedisError:
            logger.exception(
                "Failed invalidating recommendation cache for user_id=%s",
                user_id,
            )
