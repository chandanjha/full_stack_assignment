import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.repositories.token_blacklist_repository import TokenBlacklistRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.token import RefreshTokenRequest, Token
from app.services.dto.auth_dto import LoginResult


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_blacklist_repo = TokenBlacklistRepository(db)

    async def register_user(self, payload: SignupRequest):
        existing_user = await self.user_repo.get_user_by_email(payload.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        hashed_password = hash_password(payload.password)
        return await self.user_repo.create_user(payload.email, hashed_password)

    async def authenticate_user(self, payload: LoginRequest) -> LoginResult:
        user = await self.user_repo.get_user_by_email(payload.email)
        if not user or not user.is_active:
            self._unauthorized("Invalid credentials")

        if not verify_password(payload.password, user.password_hash):
            self._unauthorized("Invalid credentials")

        tokens = self._issue_tokens(str(user.id))
        return LoginResult(user=user, token=tokens)

    async def refresh_tokens(self, payload: RefreshTokenRequest) -> Token:
        token_payload = await self._decode_and_validate_token(
            payload.refresh_token,
            expected_type="refresh",
            error_detail="Invalid refresh token",
        )

        sub = token_payload.get("sub")
        if not sub:
            self._unauthorized("Invalid refresh token")

        try:
            user_uuid = uuid.UUID(sub)
        except ValueError:
            self._unauthorized("Invalid refresh token")

        user = await self.user_repo.get_user_by_id(user_uuid)
        if not user or not user.is_active:
            self._unauthorized("Invalid refresh token")

        await self.token_blacklist_repo.blacklist_token(
            jti=token_payload["jti"],
            token_type=token_payload["type"],
            expires_at=self._get_expiry_datetime(token_payload["exp"]),
        )

        return self._issue_tokens(str(user.id))

    async def logout_token(self, token: str) -> None:
        token_payload = await self._decode_and_validate_token(
            token,
            expected_type="access",
            error_detail="Invalid token",
        )
        await self.token_blacklist_repo.blacklist_token(
            jti=token_payload["jti"],
            token_type=token_payload["type"],
            expires_at=self._get_expiry_datetime(token_payload["exp"]),
        )

    def _issue_tokens(self, user_id: str) -> Token:
        return Token(
            access_token=create_access_token(user_id),
            refresh_token=create_refresh_token(user_id),
            token_type="bearer",
        )

    async def _decode_and_validate_token(
        self,
        token: str,
        expected_type: str,
        error_detail: str,
    ) -> dict[str, Any]:
        try:
            payload = decode_token(token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_detail,
            ) from exc

        token_type = payload.get("type")
        jti = payload.get("jti")
        exp = payload.get("exp")
        sub = payload.get("sub")

        if token_type != expected_type or not jti or not exp or not sub:
            self._unauthorized(error_detail)

        if await self.token_blacklist_repo.is_blacklisted(jti):
            self._unauthorized(error_detail)

        return payload

    @staticmethod
    def _get_expiry_datetime(exp_claim) -> datetime:
        if isinstance(exp_claim, datetime):
            return exp_claim.replace(tzinfo=None) if exp_claim.tzinfo else exp_claim
        return datetime.fromtimestamp(exp_claim, tz=timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _unauthorized(detail: str) -> None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)