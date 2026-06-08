"""
Expenses router — /api/v1/expenses
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.expenses.schemas import (
    ExpenseCreate, ExpenseUpdate, ExpenseOut,
    ExpenseStatsOut, ExpenseParseVoiceRequest, ExpenseParseReceiptResponse,
)
from app.modules.expenses.service import (
    ExpenseService, parse_expense_from_text, parse_expense_from_receipt,
)

router = APIRouter()


async def _get_master(user: dict, db: AsyncSession):
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    return master


@router.post("/", response_model=ExpenseOut, status_code=201)
async def create_expense(
    body: ExpenseCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать расход."""
    master = await _get_master(user, db)
    service = ExpenseService(db)
    return await service.create(master.id, body.model_dump())


@router.get("/", response_model=List[ExpenseOut])
async def list_expenses(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список расходов мастера."""
    master = await _get_master(user, db)
    service = ExpenseService(db)
    return await service.list_by_master(
        master.id, year=year, month=month, category=category,
        limit=limit, offset=offset,
    )


@router.get("/stats", response_model=ExpenseStatsOut)
async def expense_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Статистика расходов."""
    master = await _get_master(user, db)
    service = ExpenseService(db)
    return await service.stats(master.id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить расход."""
    master = await _get_master(user, db)
    service = ExpenseService(db)
    result = await service.update(expense_id, master.id, body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Expense not found")
    return result


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить расход."""
    master = await _get_master(user, db)
    service = ExpenseService(db)
    if not await service.delete(expense_id, master.id):
        raise HTTPException(status_code=404, detail="Expense not found")


@router.post("/parse-voice", response_model=ExpenseParseReceiptResponse)
async def parse_voice(
    body: ExpenseParseVoiceRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Распарсить расход из голосового ввода (текст транскрипции)."""
    await _get_master(user, db)  # auth check
    data = await parse_expense_from_text(body.transcript)
    return data


@router.post("/parse-receipt", response_model=ExpenseParseReceiptResponse)
async def parse_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Распарсить расход из фото чека (GPT-4o Vision)."""
    await _get_master(user, db)  # auth check
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB max
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    data = await parse_expense_from_receipt(image_bytes, file.filename or "receipt.jpg")
    return data
