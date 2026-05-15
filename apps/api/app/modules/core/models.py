"""
FeatureFlags — тарифные ограничения per-мастер.
SystemSetting — ключ-значение системных настроек (без деплоя).
AccessGrant — гранты доступа (trial, promo, manual, gift).
PlatformPromoCode — промо-коды платформы для доступа к тарифам.
"""

from sqlalchemy import Column, Integer, Boolean, String, Text, ForeignKey, Date

from app.core.base_model import BaseModel, TimestampMixin
from app.core.database import Base


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)


class FeatureFlags(Base, TimestampMixin):
    __tablename__ = "feature_flags"

    master_id = Column(
        Integer,
        ForeignKey("masters.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Модули
    booking_enabled = Column(Boolean, default=True)
    crm_basic = Column(Boolean, default=False)
    crm_advanced = Column(Boolean, default=False)
    promo_enabled = Column(Boolean, default=False)
    loyalty_enabled = Column(Boolean, default=False)
    client_subscriptions = Column(Boolean, default=False)
    waitlist_enabled = Column(Boolean, default=False)
    analytics_enabled = Column(Boolean, default=False)
    ai_advisor = Column(Boolean, default=False)
    ai_client_bot = Column(Boolean, default=False)
    ai_voice = Column(Boolean, default=False)
    portfolio_enabled = Column(Boolean, default=False)
    marketplace_enabled = Column(Boolean, default=False)
    marketplace_featured = Column(Boolean, default=False)
    widget_enabled = Column(Boolean, default=False)
    consultations_enabled = Column(Boolean, default=False)
    multi_location = Column(Boolean, default=False)
    reviews_enabled = Column(Boolean, default=False)
    broadcast_enabled = Column(Boolean, default=False)

    # Лимиты
    max_bookings_per_month = Column(Integer, default=30)
    max_services = Column(Integer, default=3)
    max_locations = Column(Integer, default=1)
    ai_tokens_monthly = Column(Integer, default=0)

    # Комиссия (базисные пункты: 700 = 7.00%)
    commission_rate_bp = Column(Integer, default=700)


class AccessGrant(BaseModel):
    """Гранты доступа к тарифам: trial, promo_code, manual, gift."""

    __tablename__ = "access_grants"

    master_id = Column(
        Integer,
        ForeignKey("masters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    grant_type = Column(
        String(20),
        nullable=False,
    )  # trial | promo_code | manual | gift
    plan = Column(String(20), nullable=False, default="pro")
    valid_until = Column(Date, nullable=False)
    promo_code = Column(String(50), nullable=True)
    granted_by = Column(String(100), nullable=True)  # superadmin platform_id or 'system'
    note = Column(Text, nullable=True)


class PlatformPromoCode(BaseModel):
    """Промо-коды платформы для доступа к тарифам (не промо на услуги мастера)."""

    __tablename__ = "platform_promo_codes"

    code = Column(String(50), unique=True, nullable=False, index=True)
    plan = Column(String(20), nullable=False)
    duration_days = Column(Integer, nullable=False)
    max_uses = Column(Integer, nullable=True)  # NULL = unlimited
    used_count = Column(Integer, default=0)
    valid_until = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
