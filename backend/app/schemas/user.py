from pydantic import BaseModel

from app.constants import UserRole
from app.models.user import User


class UserDetail(BaseModel):
    """Public user response schema."""
    id: str
    email: str
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_user(cls, user: User):
        """Create UserPublic from User model."""
        return cls(
            id=str(user.id),
            email=user.email,
            role=UserRole(user.role),
            is_active=user.is_active
        )
