"""
Feature Flags router — /api/v1/feature-flags
Возвращает текущие флаги для авторизованного мастера.
Использует check_master_access для определения активного плана.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.feature_flags import check_master_access
from app.modules.core.models import FeatureFlags, AccessGrant
from app.modules.masters.service import MasterService

router = APIRouter()


async def _get_active_grant(master_id: int, db: AsyncSession):
    result = await db.execute(
        select(AccessGrant).where(
            and_(
                AccessGrant.master_id == master_id,
                AccessGrant.valid_until >= date.today(),
            )
        ).order_by(AccessGrant.valid_until.desc())
    )
    return result.scalars().first()


def _trial_payload(grant) -> dict:
    if not grant:
        return {
            "is_trial": False,
            "grant_type": None,
            "grant_plan": None,
            "grant_valid_until": None,
            "grant_days_left": None,
        }
    days_left = (grant.valid_until - date.today()).days
    return {
        "is_trial": grant.grant_type == "trial",
        "grant_type": grant.grant_type,
        "grant_plan": grant.plan,
        "grant_valid_until": str(grant.valid_until),
        "grant_days_left": max(0, days_left),
    }


@router.get("")
async def get_feature_flags(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить feature flags для текущего мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    active_plan = await check_master_access(master.id, db)
    active_grant = await _get_active_grant(master.id, db)
    trial = _trial_payload(active_grant)

    result = await db.execute(
        select(FeatureFlags).where(FeatureFlags.master_id == master.id)
    )
    flags = result.scalar_one_or_none()

    if not flags:
        return {
            "tariff_plan": active_plan,
            "ai_advisor": False,
            "ai_voice": False,
            "ai_content": False,
            "crm_enabled": False,
            "broadcast_enabled": False,
            "loyalty_enabled": False,
            "subscriptions_enabled": False,
            "consultations_enabled": False,
            "portfolio_enabled": False,
            "locations_enabled": False,
            "analytics_enabled": False,
            "waitlist_enabled": False,
            "custom_branding": False,
            "trial": trial,
        }

    return {
        "tariff_plan": active_plan,
        "ai_advisor": flags.ai_advisor,
        "ai_voice": flags.ai_voice,
        "ai_content": flags.ai_client_bot,
        "crm_enabled": flags.crm_basic or flags.crm_advanced,
        "broadcast_enabled": flags.broadcast_enabled,
        "loyalty_enabled": flags.loyalty_enabled,
        "subscriptions_enabled": flags.client_subscriptions,
        "client_subscriptions": flags.client_subscriptions,
        "consultations_enabled": flags.consultations_enabled,
        "portfolio_enabled": flags.portfolio_enabled,
        "locations_enabled": flags.multi_location,
        "analytics_enabled": flags.analytics_enabled,
        "waitlist_enabled": flags.waitlist_enabled,
        "custom_branding": flags.widget_enabled,
        "widget_enabled": flags.widget_enabled,
        "trial": trial,
    }
