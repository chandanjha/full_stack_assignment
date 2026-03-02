import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User
from app.providers import build_storage_provider
from app.repositories.token_blacklist_repository import TokenBlacklistRepository
from app.services.auth_service import AuthService
from app.services.book_service import BookService
from app.services.recommendation_service import RecommendationService
from app.services.review_service import ReviewService

security = HTTPBearer()


async def get_db():
    """Get database session."""
    async with SessionLocal() as db:
        yield db


def get_auth_service(db: AsyncSession = Depends(get_db)):
    """Get authentication service instance."""
    return AuthService(db)


def get_book_service(db: AsyncSession = Depends(get_db)):
    """Get book service instance."""
    return BookService(db, storage=build_storage_provider())


def get_review_service(db: AsyncSession = Depends(get_db)):
    """Get review service instance."""
    return ReviewService(db)


def get_recommendation_service(db: AsyncSession = Depends(get_db)):
    """Get recommendation service instance."""
    return RecommendationService(db)


def get_bearer_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    return credentials.credentials


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        jti = payload.get("jti")
        if user_id is None or token_type != "access" or not jti:
            raise credentials_exception

        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise credentials_exception

    token_blacklist_repo = TokenBlacklistRepository(db)
    if await token_blacklist_repo.is_blacklisted(jti):
        raise credentials_exception

    user = await db.scalar(select(User).where(User.id == user_uuid))
    if user is None:
        raise credentials_exception

    return user
