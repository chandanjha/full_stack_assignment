from fastapi import APIRouter, Depends, status

from app.api.dependency import get_bearer_token, get_current_user, get_auth_service
from app.models.user import User
from app.schemas.auth import LoginRequest, SignupRequest, LoginResponse
from app.schemas.token import RefreshTokenRequest, Token
from app.schemas.user import UserDetail
from app.services.auth_service import AuthService
from app.schemas.response import SuccessResponse
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup", response_model=SuccessResponse[UserDetail], status_code=status.HTTP_201_CREATED, summary="Create an account")
async def signup(payload: SignupRequest, service: AuthService = Depends(get_auth_service)):
    user = await service.register_user(payload)
    return SuccessResponse(
        message="Signup successful",
        data=UserDetail.from_orm_user(user),
        )

@router.post("/login", response_model=SuccessResponse[LoginResponse], status_code=status.HTTP_200_OK, summary="Login with email and password")
async def login(payload: LoginRequest, service: AuthService = Depends(get_auth_service)):
    result = await service.authenticate_user(payload)
    return SuccessResponse(
        message="Login successful",
        data=LoginResponse(
            user=UserDetail.from_orm_user(result.user),
            token=result.token,
        ),
    )


@router.post("/refresh", response_model=SuccessResponse[Token], status_code=status.HTTP_200_OK, summary="Refresh access token using refresh token")
async def refresh(payload: RefreshTokenRequest, service: AuthService = Depends(get_auth_service)):
    return SuccessResponse(
        message="Tokens refreshed",
        data=await service.refresh_tokens(payload),
    )


@router.get("/me", response_model=SuccessResponse[UserDetail], status_code=status.HTTP_200_OK, summary="Get current user profile")
async def get_me(current_user: User = Depends(get_current_user)):
    return SuccessResponse(
        message="Profile fetched",
        data=UserDetail.from_orm_user(current_user),
    )


@router.post("/logout", response_model=SuccessResponse[None], status_code=status.HTTP_200_OK, summary="Logout current session")
async def logout(
    token: str = Depends(get_bearer_token),
    service: AuthService = Depends(get_auth_service),
):
    await service.logout_token(token)
    return SuccessResponse(message="Logged out")
