from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan


class LoanRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_loan(self, user_id: UUID, book_id: UUID) -> Loan:
        loan = Loan(user_id=user_id, book_id=book_id)
        self.db.add(loan)
        await self.db.commit()
        await self.db.refresh(loan)
        return loan

    async def get_active_loan(self, user_id: UUID, book_id: UUID) -> Optional[Loan]:
        return await self.db.scalar(
            select(Loan).where(
                Loan.user_id == user_id,
                Loan.book_id == book_id,
                Loan.returned_at.is_(None),
            )
        )

    async def has_any_loan(self, user_id: UUID, book_id: UUID) -> bool:
        existing = await self.db.scalar(
            select(Loan).where(
                Loan.user_id == user_id,
                Loan.book_id == book_id,
            )
        )
        return existing is not None

    async def list_user_loans(self, user_id: UUID) -> list[Loan]:
        result = await self.db.execute(
            select(Loan)
            .where(Loan.user_id == user_id)
            .order_by(Loan.borrowed_at.desc())
        )
        return list(result.scalars().all())

    async def return_loan(self, loan: Loan) -> Loan:
        loan.returned_at = datetime.utcnow()
        self.db.add(loan)
        await self.db.commit()
        await self.db.refresh(loan)
        return loan
