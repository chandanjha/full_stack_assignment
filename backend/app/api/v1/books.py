from math import ceil
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, status

from app.api.dependency import (
    get_book_service,
    get_current_user,
    get_recommendation_service,
    get_review_service,
)
from app.models.user import User
from app.schemas.book import BookCreate, BookPublic, BookUpdate
from app.schemas.library import (
    BookInsightPublic,
    LoanPublic,
    RecommendationPublic,
    ReviewCreate,
    ReviewPublic,
    UserPreferencePublic,
)
from app.schemas.response import PaginatedSuccessResponse, PaginationMeta, SuccessResponse
from app.services.book_service import BookService
from app.services.recommendation_service import RecommendationService
from app.services.review_service import ReviewService
from app.workers import (
    generate_book_summary_job,
    update_book_review_consensus_job,
    update_user_preferences_job,
)

router = APIRouter(prefix="/books", tags=["Books"])


def _parse_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []
    return [tag.strip() for tag in raw_tags.split(",") if tag.strip()]


@router.post("", response_model=SuccessResponse[BookPublic], status_code=status.HTTP_201_CREATED)
async def create_book(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    author: str | None = Form(None),
    tags: str | None = Form(None),
    file: UploadFile = File(...),
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    book = await service.create_book(
        BookCreate(title=title, author=author, tags=_parse_tags(tags)),
        file,
        current_user,
    )
    background_tasks.add_task(generate_book_summary_job, str(book.id))
    return SuccessResponse(
        status_code=status.HTTP_201_CREATED,
        message="Book uploaded successfully",
        data=book,
    )


@router.get("", response_model=PaginatedSuccessResponse[BookPublic], status_code=status.HTTP_200_OK)
async def list_books(
    page: int = 1,
    page_size: int = 2,
    service: BookService = Depends(get_book_service),
    _: User = Depends(get_current_user),
):
    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    books, total = await service.list_books(safe_page, safe_page_size)
    total_pages = ceil(total / safe_page_size) if total else 0
    return PaginatedSuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Books fetched successfully",
        data=books,
        meta=PaginationMeta(
            page=safe_page,
            page_size=safe_page_size,
            total_items=total,
            total_pages=total_pages,
            has_next=safe_page < total_pages,
            has_prev=safe_page > 1 and total > 0,
        ),
    )


@router.get("/recommendations", response_model=SuccessResponse[list[RecommendationPublic]], status_code=status.HTTP_200_OK)
async def recommend_books(
    limit: int = 5,
    service: RecommendationService = Depends(get_recommendation_service),
    current_user: User = Depends(get_current_user),
):
    recommendations = await service.recommend_books(current_user, limit=limit)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Recommendations generated successfully",
        data=recommendations,
    )


@router.get("/preferences/me", response_model=SuccessResponse[UserPreferencePublic], status_code=status.HTTP_200_OK)
async def get_my_preferences(
    service: RecommendationService = Depends(get_recommendation_service),
    current_user: User = Depends(get_current_user),
):
    preference = await service.get_user_preferences(current_user.id)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="User preferences fetched successfully",
        data=preference,
    )


@router.put("/{book_id}", response_model=SuccessResponse[BookPublic], status_code=status.HTTP_200_OK)
async def update_book(
    book_id: UUID,
    payload: BookUpdate,
    service: BookService = Depends(get_book_service),
    _: User = Depends(get_current_user),
):
    book = await service.update_book(book_id, payload)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Book updated successfully",
        data=book,
    )


@router.delete("/{book_id}", response_model=SuccessResponse, status_code=status.HTTP_200_OK)
async def delete_book(
    book_id: UUID,
    service: BookService = Depends(get_book_service),
    _: User = Depends(get_current_user),
):
    await service.delete_book(book_id)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Book deleted successfully",
        data=None,
    )


@router.post("/{book_id}/borrow", response_model=SuccessResponse[LoanPublic], status_code=status.HTTP_200_OK)
async def borrow_book(
    book_id: UUID,
    background_tasks: BackgroundTasks,
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    loan = await service.borrow_book(book_id, current_user)
    background_tasks.add_task(update_user_preferences_job, str(current_user.id))
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Book borrowed successfully",
        data=loan,
    )


@router.post("/{book_id}/return", response_model=SuccessResponse[LoanPublic], status_code=status.HTTP_200_OK)
async def return_book(
    book_id: UUID,
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    loan = await service.return_book(book_id, current_user)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Book returned successfully",
        data=loan,
    )


@router.post("/{book_id}/reviews", response_model=SuccessResponse[ReviewPublic], status_code=status.HTTP_201_CREATED)
async def create_review(
    book_id: UUID,
    payload: ReviewCreate,
    background_tasks: BackgroundTasks,
    service: ReviewService = Depends(get_review_service),
    current_user: User = Depends(get_current_user),
):
    review = await service.create_review(book_id, payload, current_user)
    background_tasks.add_task(update_book_review_consensus_job, str(book_id))
    background_tasks.add_task(update_user_preferences_job, str(current_user.id))
    return SuccessResponse(
        status_code=status.HTTP_201_CREATED,
        message="Review submitted successfully",
        data=review,
    )


@router.get("/{book_id}/reviews", response_model=SuccessResponse[list[ReviewPublic]], status_code=status.HTTP_200_OK)
async def list_reviews(
    book_id: UUID,
    service: ReviewService = Depends(get_review_service),
    _: User = Depends(get_current_user),
):
    reviews = await service.list_reviews(book_id)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Reviews fetched successfully",
        data=reviews,
    )


@router.get("/{book_id}/insight", response_model=SuccessResponse[BookInsightPublic], status_code=status.HTTP_200_OK)
async def get_book_insight(
    book_id: UUID,
    service: ReviewService = Depends(get_review_service),
    _: User = Depends(get_current_user),
):
    insight = await service.get_book_insight(book_id)
    return SuccessResponse(
        status_code=status.HTTP_200_OK,
        message="Book insight fetched successfully",
        data=insight,
    )
