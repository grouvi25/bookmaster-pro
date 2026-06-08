"""
Expenses — учёт расходов мастера.
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Text, Date,
    ForeignKey,
)

from app.core.base_model import BaseModel


class Expense(BaseModel):
    __tablename__ = "expenses"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(50), nullable=False)
    # categories: materials, rent, transport, equipment, education, marketing, subscriptions, other
    description = Column(Text, nullable=True)
    expense_date = Column(Date, nullable=False)
    receipt_url = Column(String(500), nullable=True)  # S3 URL for receipt photo
    source = Column(String(20), nullable=False, default="manual")
    # source: manual, voice, receipt_photo
