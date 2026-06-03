"""
NPS router — /api/v1/nps
Ежеквартальный NPS-опрос мастеров.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel as PydanticBase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.nps.models import NPSSurvey

router = APIRouter()


def _current_quarter() -> str:
    now = datetime.now(timezone.utc)
    q = (now.month - 1) // 3 + 1
    return f"{now.year}-Q{q}"


class NPSSubmit(PydanticBase):
    score: int  # 0-10
    comment: Optional[str] = None


@router.get("/current")
async def get_current_survey(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить текущий NPS-опрос мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    quarter = _current_quarter()
    result = await db.execute(
        select(NPSSurvey).where(
            NPSSurvey.master_id == master.id,
            NPSSurvey.quarter == quarter,
        )
    )
    survey = result.scalar_one_or_none()

    if not survey:
        survey = NPSSurvey(
            master_id=master.id,
            quarter=quarter,
            status="pending",
        )
        db.add(survey)
        await db.flush()
        await db.commit()

    # Не показываем NPS новым мастерам — только после 21 дня с регистрации
    min_age = timedelta(days=21)
    now = datetime.now(timezone.utc)
    account_age_ok = (
        master.created_at is not None
        and (now - master.created_at.replace(tzinfo=timezone.utc)) >= min_age
    )

    return {
        "id": survey.id,
        "quarter": survey.quarter,
        "score": survey.score,
        "comment": survey.comment,
        "status": survey.status,
        "should_show": survey.status == "pending" and account_age_ok,
    }


@router.post("/submit")
async def submit_nps(
    body: NPSSubmit,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ответить на NPS-опрос."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    if not 0 <= body.score <= 10:
        raise HTTPException(status_code=400, detail="Score must be 0-10")

    quarter = _current_quarter()
    result = await db.execute(
        select(NPSSurvey).where(
            NPSSurvey.master_id == master.id,
            NPSSurvey.quarter == quarter,
        )
    )
    survey = result.scalar_one_or_none()
    if not survey:
        survey = NPSSurvey(master_id=master.id, quarter=quarter)
        db.add(survey)

    survey.score = body.score
    survey.comment = body.comment
    survey.status = "responded"
    survey.responded_at = datetime.now(timezone.utc)

    await db.commit()
    return {"status": "ok", "score": survey.score}


@router.get("/dashboard")
async def nps_dashboard(
    quarter: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """NPS дашборд для суперадмина."""
    target_q = quarter or _current_quarter()

    result = await db.execute(
        select(NPSSurvey).where(
            NPSSurvey.quarter == target_q,
            NPSSurvey.status == "responded",
        )
    )
    surveys = result.scalars().all()

    if not surveys:
        return {"quarter": target_q, "nps": 0, "responses": 0, "promoters": 0, "passives": 0, "detractors": 0}

    total = len(surveys)
    promoters = sum(1 for s in surveys if s.score >= 9)
    passives = sum(1 for s in surveys if 7 <= s.score <= 8)
    detractors = sum(1 for s in surveys if s.score <= 6)
    nps = round((promoters - detractors) / total * 100)

    return {
        "quarter": target_q,
        "nps": nps,
        "responses": total,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "avg_score": round(sum(s.score for s in surveys) / total, 1),
    }
