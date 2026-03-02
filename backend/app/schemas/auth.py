import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic_core import PydanticCustomError
from app.schemas.token import Token
from app.schemas.user import UserDetail

PASSWORD_REGEX = re.compile(
    r"^(?=.*[a-z])"
    r"(?=.*[A-Z])"
    r"(?=.*\d)"
    r"(?=.*[^\w\s])"
    r".{8,16}$"
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=16)

    @field_validator("password")
    @classmethod
    def validate_password(cls, password: str) -> str:
        if not PASSWORD_REGEX.match(password):
            raise PydanticCustomError(
                "password_invalid",
                "Password must be 8–16 characters and include upper, lower, number, and special character.",
            )
        return password


class LoginResponse(BaseModel):
    user: UserDetail
    token: Token