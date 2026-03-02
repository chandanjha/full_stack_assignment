import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email(self, email: str) -> Optional[User]:
        return await self.db.scalar(select(User).where(User.email == email))

    async def create_user(self, email: str, password_hash: str) -> User:
        new_user = User(
            email=email,
            password_hash=password_hash,
            is_active=True,
        )
        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)
        return new_user

    async def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return await self.db.scalar(select(User).where(User.id == user_id))
