from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str


class APIResponse(BaseModel):
    """Standard API response schema."""

    success: bool
    status_code: int
    message: Optional[str] = None
    data: Optional[Any] = None
    errors: Optional[list[ErrorDetail]] = None


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: Optional[T] = None


class PaginatedSuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    status_code: int
    message: str
    data: list[T]
    meta: PaginationMeta


class ErrorResponse(BaseModel):
    success: bool = False
    status_code: int
    message: str
    errors: list[ErrorDetail] = Field(default_factory=list)
