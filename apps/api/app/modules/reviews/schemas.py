"""
Reviews schemas.
"""

from typing import Optional

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    appointment_id: int
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = None


class ReviewReply(BaseModel):
    master_reply: str


class ReviewOut(BaseModel):
    id: int
    appointment_id: int
    master_id: int
    client_id: int
    rating: int
    text: Optional[str] = None
    master_reply: Optional[str] = None
    is_hidden: bool = False

    model_config = {"from_attributes": True}
