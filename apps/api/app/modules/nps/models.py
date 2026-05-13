"""
NPS — Net Promoter Score опросы мастеров.
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    ForeignKey,
)

from app.core.base_model import BaseModel


class NPSSurvey(BaseModel):
    __tablename__ = "nps_surveys"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    quarter = Column(String(10), nullable=False)  # "2026-Q2"
    score = Column(Integer, nullable=True)  # 0-10
    comment = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="pending")
    # pending | responded | expired
