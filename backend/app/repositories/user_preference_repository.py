from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_preference import UserPreference


class UserPreferenceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: UUID) -> UserPreference | None:
        return await self.db.scalar(select(UserPreference).where(UserPreference.user_id == user_id))

    async def upsert(
        self,
        user_id: UUID,
        preferred_tags: list[str],
        preferred_authors: list[str],
        preference_summary: str | None,
    ) -> UserPreference:
        preference = await self.get_by_user_id(user_id)
        if preference is None:
            preference = UserPreference(
                user_id=user_id,
                preferred_tags=preferred_tags,
                preferred_authors=preferred_authors,
                preference_summary=preference_summary,
            )
        else:
            preference.preferred_tags = preferred_tags
            preference.preferred_authors = preferred_authors
            preference.preference_summary = preference_summary

        self.db.add(preference)
        await self.db.commit()
        await self.db.refresh(preference)
        return preference
