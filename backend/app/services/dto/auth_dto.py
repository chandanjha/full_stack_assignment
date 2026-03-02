from dataclasses import dataclass
from app.models.user import User
from app.schemas.token import Token


@dataclass(frozen=True)
class LoginResult:
    user: User
    token: Token