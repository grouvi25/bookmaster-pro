"""
Expenses schemas.
"""

from datetime import date
from typing import Optional
from decimal import Decimal

from pydantic import BaseModel


EXPENSE_CATEGORIES = [
    "materials",      # Материалы
    "rent",           # Аренда
    "transport",      # Транспорт
    "equipment",      # Оборудование
    "education",      # Обучение
    "marketing",      # Маркетинг / реклама
    "subscriptions",  # Подписки
    "other",          # Прочее
]


class ExpenseCreate(BaseModel):
    amount: Decimal
    category: str = "other"
    description: Optional[str] = None
    expense_date: Optional[date] = None  # default = today
    receipt_url: Optional[str] = None
    source: str = "manual"


class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[date] = None
    receipt_url: Optional[str] = None


class ExpenseOut(BaseModel):
    id: int
    master_id: int
    amount: Decimal
    category: str
    description: Optional[str] = None
    expense_date: date
    receipt_url: Optional[str] = None
    source: str
    created_at: str  # ISO string

    model_config = {"from_attributes": True}


class ExpenseStatsOut(BaseModel):
    total_month: Decimal = Decimal("0")
    total_prev_month: Decimal = Decimal("0")
    by_category: dict = {}
    count_month: int = 0


class ExpenseParseVoiceRequest(BaseModel):
    transcript: str


class ExpenseParseReceiptResponse(BaseModel):
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    description: Optional[str] = None
    expense_date: Optional[date] = None
    items: list = []  # Individual line items from receipt
