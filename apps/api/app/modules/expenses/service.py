"""
Expenses service — CRUD + AI parsing.
"""

import json
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import select, func, extract, and_, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.expenses.models import Expense
from app.modules.expenses.schemas import ExpenseCreate, EXPENSE_CATEGORIES

logger = logging.getLogger(__name__)


class ExpenseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, master_id: int, data: dict) -> Expense:
        if not data.get("expense_date"):
            data["expense_date"] = date.today()
        if data.get("category") and data["category"] not in EXPENSE_CATEGORIES:
            data["category"] = "other"
        expense = Expense(master_id=master_id, **data)
        self.db.add(expense)
        await self.db.commit()
        await self.db.refresh(expense)
        return expense

    async def list_by_master(
        self,
        master_id: int,
        year: Optional[int] = None,
        month: Optional[int] = None,
        category: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Expense]:
        q = select(Expense).where(Expense.master_id == master_id)
        if year and month:
            q = q.where(
                and_(
                    extract("year", Expense.expense_date) == year,
                    extract("month", Expense.expense_date) == month,
                )
            )
        if category:
            q = q.where(Expense.category == category)
        q = q.order_by(Expense.expense_date.desc(), Expense.id.desc())
        q = q.limit(limit).offset(offset)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get(self, expense_id: int, master_id: int) -> Optional[Expense]:
        q = select(Expense).where(
            Expense.id == expense_id,
            Expense.master_id == master_id,
        )
        result = await self.db.execute(q)
        return result.scalar_one_or_none()

    async def update(self, expense_id: int, master_id: int, data: dict) -> Optional[Expense]:
        expense = await self.get(expense_id, master_id)
        if not expense:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(expense, k, v)
        await self.db.commit()
        await self.db.refresh(expense)
        return expense

    async def delete(self, expense_id: int, master_id: int) -> bool:
        expense = await self.get(expense_id, master_id)
        if not expense:
            return False
        await self.db.delete(expense)
        await self.db.commit()
        return True

    async def stats(self, master_id: int) -> dict:
        today = date.today()
        first_of_month = today.replace(day=1)
        if first_of_month.month == 1:
            first_of_prev = first_of_month.replace(year=first_of_month.year - 1, month=12)
        else:
            first_of_prev = first_of_month.replace(month=first_of_month.month - 1)

        # Current month total
        q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.master_id == master_id,
            Expense.expense_date >= first_of_month,
        )
        total_month = (await self.db.execute(q)).scalar() or Decimal("0")

        # Previous month total
        q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.master_id == master_id,
            Expense.expense_date >= first_of_prev,
            Expense.expense_date < first_of_month,
        )
        total_prev = (await self.db.execute(q)).scalar() or Decimal("0")

        # By category this month
        q = (
            select(Expense.category, func.sum(Expense.amount))
            .where(
                Expense.master_id == master_id,
                Expense.expense_date >= first_of_month,
            )
            .group_by(Expense.category)
        )
        rows = (await self.db.execute(q)).all()
        by_cat = {r[0]: float(r[1]) for r in rows}

        # Count this month
        q = select(func.count()).where(
            Expense.master_id == master_id,
            Expense.expense_date >= first_of_month,
        ).select_from(Expense)
        count = (await self.db.execute(q)).scalar() or 0

        return {
            "total_month": float(total_month),
            "total_prev_month": float(total_prev),
            "by_category": by_cat,
            "count_month": count,
        }


async def parse_expense_from_text(transcript: str) -> dict:
    """Use AI to parse expense from voice transcript or text."""
    from app.modules.ai.providers import get_ai_provider

    provider = get_ai_provider()
    prompt = f"""Извлеки информацию о расходе из текста. Верни JSON:
{{
  "amount": число (обязательно),
  "category": одна из [{', '.join(EXPENSE_CATEGORIES)}],
  "description": краткое описание (1-2 слова),
  "expense_date": "YYYY-MM-DD" или null если не указана
}}

Текст: "{transcript}"

Только JSON, без markdown."""

    try:
        result = await provider.generate(prompt, max_tokens=200)
        # Strip markdown code block if present
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        if text.startswith("json"):
            text = text[4:].strip()
        data = json.loads(text)
        # Validate category
        if data.get("category") not in EXPENSE_CATEGORIES:
            data["category"] = "other"
        return data
    except Exception as e:
        logger.error(f"AI expense parse error: {e}")
        return {}


async def parse_expense_from_receipt(image_bytes: bytes, filename: str = "receipt.jpg") -> dict:
    """Use GPT-4o Vision to parse receipt photo."""
    import base64
    import httpx
    from app.core.config import settings

    b64 = base64.b64encode(image_bytes).decode()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpeg"
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg")

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"""Распознай чек/квитанцию на фото. Верни JSON:
{{
  "amount": итоговая сумма (число),
  "category": одна из [{', '.join(EXPENSE_CATEGORIES)}],
  "description": краткое описание покупки,
  "expense_date": "YYYY-MM-DD" или null,
  "items": [
    {{"name": "название товара", "qty": 1, "price": 100}},
    ...
  ]
}}
Только JSON, без markdown.""",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                },
            ],
        }
    ]

    try:
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        base_url = settings.AI_PROXY_URL or "https://api.openai.com/v1"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json={
                    "model": settings.OPENAI_MODEL_SMART,  # gpt-4o
                    "messages": messages,
                    "max_tokens": 500,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            # Strip markdown
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            if text.startswith("json"):
                text = text[4:].strip()
            data = json.loads(text)
            if data.get("category") not in EXPENSE_CATEGORIES:
                data["category"] = "other"
            return data
    except Exception as e:
        logger.error(f"Receipt parse error: {e}")
        return {}
