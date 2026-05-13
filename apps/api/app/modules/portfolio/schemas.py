"""Portfolio schemas."""

from pydantic import BaseModel, Field, computed_field
from typing import Optional
from datetime import datetime

from app.core.config import settings


class WorkPhotoCreate(BaseModel):
    s3_key: str
    caption: Optional[str] = Field(None, max_length=500)
    client_id: Optional[int] = None
    appointment_id: Optional[int] = None
    is_portfolio: bool = True


class WorkPhotoUpdate(BaseModel):
    caption: Optional[str] = Field(None, max_length=500)
    is_portfolio: Optional[bool] = None
    sort_order: Optional[int] = None


class WorkPhotoOut(BaseModel):
    id: int
    master_id: int
    client_id: Optional[int]
    appointment_id: Optional[int]
    s3_key: str
    caption: Optional[str]
    is_portfolio: bool
    sort_order: int
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_url(self) -> str:
        return f"{settings.API_URL}/api/v1/uploads/s3/{self.s3_key}"
