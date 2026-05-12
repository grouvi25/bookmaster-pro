"""
Portfolio — фото работ мастера.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    ForeignKey,
)

from app.core.base_model import BaseModel


class WorkPhoto(BaseModel):
    __tablename__ = "work_photos"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, nullable=True)
    appointment_id = Column(Integer, nullable=True)
    s3_key = Column(String(500), nullable=False)
    caption = Column(Text, nullable=True)
    is_portfolio = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
