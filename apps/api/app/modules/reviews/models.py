"""
Reviews — отзывы клиентов, рейтинги.
"""

from sqlalchemy import (
    Column, Integer, Text, Boolean, SmallInteger,
    ForeignKey, CheckConstraint,
)

from app.core.base_model import BaseModel


class ClientReview(BaseModel):
    __tablename__ = "client_reviews"

    appointment_id = Column(
        Integer, ForeignKey("appointments.id"), unique=True, nullable=False
    )
    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    rating = Column(SmallInteger, nullable=False)
    text = Column(Text, nullable=True)
    master_reply = Column(Text, nullable=True)
    is_hidden = Column(Boolean, default=False)

    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_review_rating"),
    )
