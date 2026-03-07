from math import ceil
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Response, UploadFile, status

from app.api.dependency import (
    get_book_service,
    get_current_user,
    get_recommendation_service,
    get_review_service,
)
from app.models.user import User
from app.schemas.book import BookCreate, BookDetail, BookUpdate
from app.schemas.library import (
    BookBorrowPublic,
    BookInsightPublic,
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
    refresh_user_recommendations_cache_job,
    update_book_review_consensus_job,
)

router = APIRouter(prefix="/books", tags=["Books"])


def _parse_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []
    return [tag.strip() for tag in raw_tags.split(",") if tag.strip()]


@router.post(
    "",
    response_model=SuccessResponse[BookDetail],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new book with its details and file",
)
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
    return SuccessResponse(message="Book uploaded successfully", data=book)


@router.get(
    "",
    response_model=PaginatedSuccessResponse[BookDetail],
    status_code=status.HTTP_200_OK,
    summary="List books with pagination",
)
async def list_books(
    page: int = 1,
    page_size: int = 10,
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 1), 100)
    books, total = await service.list_books(safe_page, safe_page_size, current_user.id)
    total_pages = ceil(total / safe_page_size) if total else 0
    return PaginatedSuccessResponse(
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


@router.get(
    "/recommendations",
    response_model=SuccessResponse[list[RecommendationPublic]],
    status_code=status.HTTP_200_OK,
    summary="Get GenAI content-based book recommendations for the current user",
)
async def recommend_books(
    response: Response,
    limit: int = 5,
    service: RecommendationService = Depends(get_recommendation_service),
    current_user: User = Depends(get_current_user),
):
    response.headers["Cache-Control"] = "private, no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Vary"] = "Authorization"

    recommendations = await service.recommend_books(current_user, limit=limit)
    return SuccessResponse(message="GenAI content-based recommendations fetched successfully", data=recommendations)


@router.get(
    "/preferences/me",
    response_model=SuccessResponse[UserPreferencePublic],
    status_code=status.HTTP_200_OK,
    summary="Get the current user's book preferences based on their borrowing and review history",
)
async def get_my_preferences(
    service: RecommendationService = Depends(get_recommendation_service),
    current_user: User = Depends(get_current_user),
):
    preference = await service.get_user_preferences(current_user.id)
    return SuccessResponse(message="User preferences fetched successfully", data=preference)


@router.put(
    "/{book_id}",
    response_model=SuccessResponse[BookDetail],
    status_code=status.HTTP_200_OK,
    summary="Update book details (title, author, tags)",
)
async def update_book(
    book_id: UUID,
    payload: BookUpdate,
    service: BookService = Depends(get_book_service),
    _: User = Depends(get_current_user),
):
    book = await service.update_book(book_id, payload)
    return SuccessResponse(message="Book updated successfully", data=book)


@router.delete(
    "/{book_id}",
    response_model=SuccessResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Delete a book by its ID",
)
async def delete_book(
    book_id: UUID,
    service: BookService = Depends(get_book_service),
    _: User = Depends(get_current_user),
):
    await service.delete_book(book_id)
    return SuccessResponse(message="Book deleted successfully", data=None)


@router.post(
    "/{book_id}/borrow",
    response_model=SuccessResponse[BookBorrowPublic],
    status_code=status.HTTP_200_OK,
    summary="Borrow a book by its ID (only if available)",
)
async def borrow_book(
    book_id: UUID,
    background_tasks: BackgroundTasks,
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    book_borrow = await service.borrow_book(book_id, current_user)
    background_tasks.add_task(refresh_user_recommendations_cache_job, str(current_user.id))
    return SuccessResponse(message="Book borrowed successfully", data=book_borrow)


@router.post(
    "/{book_id}/return",
    response_model=SuccessResponse[BookBorrowPublic],
    status_code=status.HTTP_200_OK,
    summary="Return a borrowed book by its ID",
)
async def return_book(
    book_id: UUID,
    service: BookService = Depends(get_book_service),
    current_user: User = Depends(get_current_user),
):
    book_borrow = await service.return_book(book_id, current_user)
    return SuccessResponse(message="Book returned successfully", data=book_borrow)


@router.post(
    "/{book_id}/reviews",
    response_model=SuccessResponse[ReviewPublic],
    status_code=status.HTTP_201_CREATED,
    summary="Submit a review for a book",
)
async def create_review(
    book_id: UUID,
    payload: ReviewCreate,
    background_tasks: BackgroundTasks,
    service: ReviewService = Depends(get_review_service),
    current_user: User = Depends(get_current_user),
):
    review = await service.create_review(book_id, payload, current_user)
    background_tasks.add_task(update_book_review_consensus_job, str(book_id))
    background_tasks.add_task(refresh_user_recommendations_cache_job, str(current_user.id))
    return SuccessResponse(message="Review submitted successfully", data=review)


@router.get(
    "/{book_id}/reviews",
    response_model=SuccessResponse[list[ReviewPublic]],
    status_code=status.HTTP_200_OK,
    summary="List all reviews for a book",
)
async def list_reviews(
    book_id: UUID,
    service: ReviewService = Depends(get_review_service),
    _: User = Depends(get_current_user),
):
    reviews = await service.list_reviews(book_id)
    return SuccessResponse(message="Reviews fetched successfully", data=reviews)


@router.get(
    "/{book_id}/insight",
    response_model=SuccessResponse[BookInsightPublic],
    status_code=status.HTTP_200_OK,
    summary="Get insights for a specific book",
)
async def get_book_insight(
    book_id: UUID,
    service: ReviewService = Depends(get_review_service),
    _: User = Depends(get_current_user),
):
    insight = await service.get_book_insight(book_id)
    return SuccessResponse(message="Book insight fetched successfully", data=insight)
