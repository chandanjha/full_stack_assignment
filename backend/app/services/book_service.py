from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import BookSummaryStatus
from app.models.user import User
from app.providers import (
    BookSummaryProvider,
    LocalBookSummaryProvider,
    StorageProvider,
    build_storage_provider,
)
from app.repositories.book_repository import BookRepository
from app.repositories.loan_repository import LoanRepository
from app.schemas.book import BookCreate, BookPublic, BookUpdate, validate_book_upload_file
from app.schemas.library import LoanPublic


class BookService:
    def __init__(
        self,
        db: AsyncSession,
        storage: StorageProvider | None = None,
        summary_provider: BookSummaryProvider | None = None,
    ):
        self.db = db
        self.book_repo = BookRepository(db)
        self.loan_repo = LoanRepository(db)
        self.storage = storage or build_storage_provider()
        self.summary_provider = summary_provider or LocalBookSummaryProvider()

    async def create_book(self, payload: BookCreate, upload_file: UploadFile, current_user: User) -> BookPublic:
        self._validate_upload(upload_file)
        stored_file = self.storage.save_book_file(upload_file)
        try:
            book = await self.book_repo.create_book(
                title=payload.title,
                author=payload.author,
                tags=payload.tags,
                file_path=stored_file.path,
                original_file_name=stored_file.original_file_name,
                mime_type=stored_file.mime_type,
                file_size=stored_file.file_size,
                created_by_id=current_user.id,
            )
        except Exception:
            self.storage.delete_book_file(stored_file.path)
            raise
        return BookPublic.from_orm_book(book)

    async def list_books(self, page: int, page_size: int) -> tuple[list[BookPublic], int]:
        offset = (page - 1) * page_size
        books = await self.book_repo.list_books(offset=offset, limit=page_size)
        total = await self.book_repo.count_books()
        return [BookPublic.from_orm_book(book) for book in books], total

    async def update_book(self, book_id: UUID, payload: BookUpdate) -> BookPublic:
        book = await self._get_book_or_404(book_id)
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(book, field, value)
        saved = await self.book_repo.save(book)
        return BookPublic.from_orm_book(saved)

    async def delete_book(self, book_id: UUID) -> None:
        book = await self._get_book_or_404(book_id)
        self.storage.delete_book_file(book.file_path)
        await self.book_repo.delete(book)

    async def borrow_book(self, book_id: UUID, current_user: User) -> LoanPublic:
        await self._get_book_or_404(book_id)
        active_loan = await self.loan_repo.get_active_loan(current_user.id, book_id)
        if active_loan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have this book borrowed",
            )

        loan = await self.loan_repo.create_loan(current_user.id, book_id)
        return LoanPublic.from_orm_loan(loan)

    async def return_book(self, book_id: UUID, current_user: User) -> LoanPublic:
        await self._get_book_or_404(book_id)
        active_loan = await self.loan_repo.get_active_loan(current_user.id, book_id)
        if not active_loan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This book is not currently borrowed by you",
            )

        returned_loan = await self.loan_repo.return_loan(active_loan)
        return LoanPublic.from_orm_loan(returned_loan)

    async def generate_summary_from_llm(self, book_id: UUID) -> None:
        book = await self.book_repo.get_book_by_id(book_id)
        if not book:
            return

        book.summary_error = None
        book.summary_status = BookSummaryStatus.PROCESSING.value
        await self.book_repo.save(book)

        try:
            with self.storage.open_book_file(book.file_path) as book_file:
                summary = self.summary_provider.generate_summary(
                    book_file,
                    book.original_file_name or book.file_path,
                    book.mime_type,
                    book.title,
                    book.author,
                )
            book.summary = summary
            book.summary_error = None
            book.summary_status = BookSummaryStatus.COMPLETED.value
        except Exception as exc:
            error_message = str(exc).strip() or "Unknown LLM error"
            book.summary = None
            book.summary_error = f"Summary generation failed: {error_message}"[:1000]
            book.summary_status = BookSummaryStatus.FAILED.value

        await self.book_repo.save(book)

    async def _get_book_or_404(self, book_id: UUID):
        book = await self.book_repo.get_book_by_id(book_id)
        if not book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Book not found",
            )
        return book

    def _validate_upload(self, upload_file: UploadFile) -> None:
        validate_book_upload_file(upload_file)
