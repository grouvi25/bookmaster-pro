"""
Monitoring router — /api/v1/monitoring
API для суперадмин-панели: ошибки, решения, бэкапы.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.monitoring.models import ErrorEvent, ErrorSolution
from app.modules.monitoring.schemas import (
    ErrorEventOut,
    ErrorEventsListOut,
    ErrorSolutionOut,
    ErrorStatusUpdate,
    SolutionCreate,
    BackupInfoOut,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _require_superadmin(user: dict) -> None:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")


# ── Ошибки ───────────────────────────────────────────────────

@router.get("/errors", response_model=ErrorEventsListOut)
async def list_errors(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список ошибок для суперадмин-панели."""
    _require_superadmin(user)

    query = select(ErrorEvent).order_by(ErrorEvent.last_seen.desc())
    count_query = select(func.count(ErrorEvent.id))

    if status:
        query = query.where(ErrorEvent.status == status)
        count_query = count_query.where(ErrorEvent.status == status)
    if severity:
        query = query.where(ErrorEvent.severity == severity)
        count_query = count_query.where(ErrorEvent.severity == severity)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.limit(limit).offset(offset))
    items = result.scalars().all()

    return ErrorEventsListOut(
        items=[
            ErrorEventOut(
                id=e.id,
                fingerprint=e.fingerprint,
                error_type=e.error_type,
                error_msg=e.error_msg,
                module=e.module,
                stack_trace=e.stack_trace,
                first_seen=e.first_seen,
                last_seen=e.last_seen,
                count=e.count or 1,
                status=e.status or "new",
                severity=e.severity or "error",
                request_id=e.request_id,
            )
            for e in items
        ],
        total=total,
    )


@router.patch("/errors/{error_id}")
async def update_error_status(
    error_id: int,
    body: ErrorStatusUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить статус ошибки (resolved, acknowledged, ignored)."""
    _require_superadmin(user)

    result = await db.execute(
        select(ErrorEvent).where(ErrorEvent.id == error_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Error event not found")

    event.status = body.status
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {"ok": True, "status": event.status}




# ── AI-подсказки ──────────────────────────────────────────────

@router.post("/errors/{error_id}/suggest-solution")
async def suggest_solution(
    error_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI анализирует стектрейс и предлагает решение."""
    _require_superadmin(user)

    result = await db.execute(
        select(ErrorEvent).where(ErrorEvent.id == error_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Error event not found")

    # Build prompt
    prompt = f"""Ты — senior Python/FastAPI разработчик проекта BookMaster Pro (FastAPI + PostgreSQL + Redis + aiogram).
Проанализируй ошибку и предложи краткое решение (1-3 конкретных действия).

Тип: {event.error_type}
Модуль: {event.module or 'unknown'}
Сообщение: {event.error_msg[:300]}
Повторений: {event.count}

Стектрейс:
{(event.stack_trace or 'Нет стектрейса')[-1500:]}

Формат ответа: краткий markdown, 1-3 пункта. Без вступлений."""

    try:
        from app.modules.ai.providers import OpenAIProvider
        provider = OpenAIProvider()
        solution_text = await provider.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=400,
        )
    except Exception as e:
        logger.error(f"AI suggest_solution failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)[:200]}")

    # Save to error_solutions
    sol = ErrorSolution(
        fingerprint=event.fingerprint,
        solution=solution_text,
        added_by="ai",
        is_verified=False,
    )
    db.add(sol)
    await db.flush()
    await db.commit()

    return {
        "solution": solution_text,
        "solution_id": sol.id,
    }

# ── Решения ──────────────────────────────────────────────────

@router.get("/solutions/{fingerprint}", response_model=list[ErrorSolutionOut])
async def get_solutions(
    fingerprint: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить решения для ошибки по fingerprint."""
    _require_superadmin(user)

    result = await db.execute(
        select(ErrorSolution)
        .where(ErrorSolution.fingerprint == fingerprint)
        .order_by(ErrorSolution.created_at.desc())
    )
    items = result.scalars().all()
    return [
        ErrorSolutionOut(
            id=s.id,
            fingerprint=s.fingerprint,
            solution=s.solution,
            added_by=s.added_by,
            is_verified=s.is_verified,
            created_at=s.created_at,
        )
        for s in items
    ]


@router.post("/solutions", response_model=ErrorSolutionOut, status_code=201)
async def create_solution(
    body: SolutionCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавить решение для ошибки."""
    _require_superadmin(user)

    sol = ErrorSolution(
        fingerprint=body.fingerprint,
        solution=body.solution,
        added_by="admin",
        is_verified=True,
    )
    db.add(sol)
    await db.flush()
    return ErrorSolutionOut(
        id=sol.id,
        fingerprint=sol.fingerprint,
        solution=sol.solution,
        added_by=sol.added_by,
        is_verified=sol.is_verified,
        created_at=sol.created_at,
    )


# ── Бэкапы (через S3) ────────────────────────────────────────

@router.get("/backups", response_model=list[BackupInfoOut])
async def list_backups(
    limit: int = Query(30, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список последних бэкапов из S3."""
    _require_superadmin(user)

    try:
        from app.modules.monitoring.backup_service import BackupService
        backups = await BackupService.list_recent(limit=limit)
        return backups
    except Exception as e:
        logger.error(f"Failed to list backups: {e}")
        return []
