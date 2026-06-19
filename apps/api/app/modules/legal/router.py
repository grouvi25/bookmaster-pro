"""
Legal documents router — /api/v1/legal

Публичные эндпоинты для юридических документов (условия сервиса,
оплата/возврат, реквизиты). Текст хранится в SystemSetting и
редактируется через суперадмин-панель без редеплоя.

Требования Робокассы:
1. Условия оказания услуг
2. Условия оплаты и возврата
3. Реквизиты юр. лица (наименование, ИНН/ОГРНИП)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# Маппинг doc_type -> ключи в SystemSetting
LEGAL_DOC_KEYS = {
    "terms": "legal_terms_of_service",
    "payment": "legal_payment_conditions",
}


class LegalDocumentResponse(BaseModel):
    doc_type: str
    title: str
    content: str
    legal_entity_name: str
    legal_entity_inn: str


DOC_TITLES = {
    "terms": "Условия оказания услуг",
    "payment": "Условия оплаты и возврата",
}


@router.get("/{doc_type}", response_model=LegalDocumentResponse)
async def get_legal_document(
    doc_type: str,
    db: AsyncSession = Depends(get_db),
):
    """Получить юридический документ по типу (terms, payment).

    Публичный эндпоинт — без авторизации.
    """
    if doc_type not in LEGAL_DOC_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown document type: {doc_type}. Available: {', '.join(LEGAL_DOC_KEYS)}",
        )

    from app.modules.core.models import SystemSetting

    rows = (
        await db.execute(
            select(SystemSetting).where(
                SystemSetting.key.in_([
                    LEGAL_DOC_KEYS[doc_type],
                    "legal_entity_name",
                    "legal_entity_inn",
                ])
            )
        )
    ).scalars().all()

    settings_map = {row.key: (row.value or "") for row in rows}

    return LegalDocumentResponse(
        doc_type=doc_type,
        title=DOC_TITLES.get(doc_type, doc_type),
        content=settings_map.get(LEGAL_DOC_KEYS[doc_type], ""),
        legal_entity_name=settings_map.get("legal_entity_name", ""),
        legal_entity_inn=settings_map.get("legal_entity_inn", ""),
    )


@router.get("/", response_model=dict)
async def list_legal_documents(
    db: AsyncSession = Depends(get_db),
):
    """Список всех доступных юридических документов."""
    return {
        "documents": [
            {"type": key, "title": title, "url": f"/legal/{key}"}
            for key, title in DOC_TITLES.items()
        ]
    }
