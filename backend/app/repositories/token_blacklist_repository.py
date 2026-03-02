from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_blacklist import TokenBlacklist


class TokenBlacklistRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def is_blacklisted(self, jti: str) -> bool:
        token = await self.db.scalar(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
        if token is None:
            return False
        now = (
            datetime.now(token.expires_at.tzinfo).replace(tzinfo=None)
            if token.expires_at.tzinfo
            else datetime.utcnow()
        )
        token_expiry = token.expires_at.replace(tzinfo=None) if token.expires_at.tzinfo else token.expires_at
        if token_expiry < now:
            return False
        return True

    async def blacklist_token(self, jti: str, token_type: str, expires_at: datetime) -> TokenBlacklist:
        existing = await self.db.scalar(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
        if existing is not None:
            return existing

        token = TokenBlacklist(
            jti=jti,
            token_type=token_type,
            expires_at=expires_at,
        )
        self.db.add(token)
        await self.db.commit()
        await self.db.refresh(token)
        return token
