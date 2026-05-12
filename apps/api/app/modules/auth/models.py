"""
Identity — единая точка идентификации пользователя.
"""

from sqlalchemy import Column, String, Boolean, DateTime, UniqueConstraint

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

    __table_args__ = (
        UniqueConstraint("platform", "platform_id", name="uq_identity_platform"),
    )
