"""AI module schemas."""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class AIChatMessage(BaseModel):
    message: str = Field(..., max_length=4000)
    session_id: Optional[str] = None


class AIContentRequest(BaseModel):
    template_key: str  # promo_post | introduction_post | review_reply | seasonal_content | faq
    params: Dict[str, Any] = {}


class AIContentResponse(BaseModel):
    template_key: str
    template_name: str
    content: str
    tokens_used: int


class AIVoiceRequest(BaseModel):
    transcript: str = Field(..., max_length=5000)
    client_id: Optional[int] = None
    appointment_id: Optional[int] = None


class AIVoiceDiaryResponse(BaseModel):
    transcript: str
    extracted: Dict[str, Any]
    saved_to_client: bool


class AIConversationOut(BaseModel):
    id: int
    session_id: str
    role: str
    content: str
    tokens_used: Optional[int]
    created_at: datetime


class AIIndexResponse(BaseModel):
    master_id: int
    chunks_created: int


class AIClientMessageRequest(BaseModel):
    master_id: int
    message: str = Field(..., max_length=2000)


class AIClientMessageResponse(BaseModel):
    response: str


class AITokensInfoResponse(BaseModel):
    ai_enabled: bool
    ai_client_bot: bool
    ai_voice: bool
    tokens_monthly_limit: int
    tokens_used_this_month: int


class AITemplateInfo(BaseModel):
    key: str
    name: str
    required_params: List[str]


class AIAskRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    context: Optional[List[Dict[str, str]]] = None
    session_id: Optional[str] = None


class AIAskResponse(BaseModel):
    response: str
    session_id: str
    tokens_used: int
