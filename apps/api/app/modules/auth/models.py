"""
Identity — единая точка идентификации пользователя.
IdentityLinkCode — временные коды для привязки аккаунтов.
"""

from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint,
)

from app.core.base_model import BaseModel


class Identity(BaseModel):
    __tablename__ = "identities"

    platform = Column(String(20), nullable=False)  # 'telegram' | 'max'
    platform_id = Column(String(50), nullable=False)
    role = Column(String(20), nullable=False, default="client")
    # Роли: 'client' | 'master' | 'moderator' | 'superadmin'

    is_banned = Column(Boolean, default=False)
    banned_at = Column(DateTime(timezone=True), nullable=True)
    banned_reason = Column(String(500), nullable=True)

    # Кросс-платформенная привязка:
    # NULL = первичная идентичность (или единственная)
    # NOT NULL = вторичная, данные берём у linked_identity_id
    linked_identity_id = Column(
        Integer,
        ForeignKey("identities.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint("platform", "platform_id", name="uq_identity_platform"),
    )


class IdentityLinkCode(BaseModel):
    __tablename__ = "identity_link_codes"

    code = Column(String(6), nullable=False, unique=True)
    identity_id = Column(
        Integer,
        ForeignKey("identities.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, server_default="false")
