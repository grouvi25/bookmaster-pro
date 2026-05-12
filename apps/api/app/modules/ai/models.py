"""
AI models — RAG knowledge, conversations, voice sessions.
"""

from sqlalchemy import (
    Column, Integer, String, Text, ForeignKey, JSON,
)
from pgvector.sqlalchemy import Vector

from app.core.base_model import BaseModel


class AIKnowledgeChunk(BaseModel):
    __tablename__ = "ai_knowledge_chunks"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(String(30), nullable=False)
    # 'profile' | 'services' | 'stats' | 'reviews' | 'custom_doc'
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)


class AIConversation(BaseModel):
    __tablename__ = "ai_conversations"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    tokens_used = Column(Integer, nullable=True)


class VoiceSession(BaseModel):
    __tablename__ = "voice_sessions"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, nullable=True)
    transcript = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=True)
    audio_s3_key = Column(String(500), nullable=True)
    tts_s3_key = Column(String(500), nullable=True)
    duration_sec = Column(Integer, nullable=True)
    tokens_used = Column(Integer, nullable=True)
