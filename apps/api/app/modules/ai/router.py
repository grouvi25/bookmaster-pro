"""
AI router — WebSocket чат, голосовой дневник, STT, контент-мастер, клиентский бот.
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_master
from app.core.feature_flags import require_feature
from app.modules.ai.service import AIService, CONTENT_TEMPLATES
from app.modules.ai.providers import get_stt_provider
from app.modules.ai.indexer import AIIndexer
from app.modules.ai.schemas import (
    AIContentRequest,
    AIContentResponse,
    AIVoiceRequest,
    AIVoiceDiaryResponse,
    AIIndexResponse,
    AIClientMessageRequest,
    AIClientMessageResponse,
    AITokensInfoResponse,
    AITemplateInfo,
    AIAskRequest,
    AIAskResponse,
    AITranscribeResponse,
)
from app.modules.masters.models import Master

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/ask", response_model=AIAskResponse)
async def ai_ask(
    req: AIAskRequest,
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Синхронный POST-чат с AI-советником."""
    service = AIService(db)
    session_id = req.session_id or str(uuid.uuid4())
    result = await service.chat(
        master_id=master.id,
        session_id=session_id,
        user_message=req.message,
    )
    await db.commit()
    return result


@router.websocket("/chat")
async def ai_chat_ws(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket стриминг AI-ответов (советник для мастера).
    Клиент шлёт JSON: {"message": "текст", "session_id": "uuid"}
    Сервер шлёт чанки текста. Последний чанк: {"done": true}
    """
    await websocket.accept()
    service = AIService(db)

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            session_id = data.get("session_id") or str(uuid.uuid4())
            master_id = data.get("master_id")

            if not message or not master_id:
                await websocket.send_json({"error": "message и master_id обязательны"})
                continue

            async for chunk in service.chat_stream(
                master_id=master_id,
                session_id=session_id,
                user_message=message,
            ):
                await websocket.send_json({"chunk": chunk, "session_id": session_id})

            await websocket.send_json({"done": True, "session_id": session_id})
            await db.commit()

    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()


@router.post("/content", response_model=AIContentResponse)
async def generate_content(
    req: AIContentRequest,
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Генерация контента по шаблону."""
    service = AIService(db)
    try:
        result = await service.generate_content(
            master_id=master.id,
            template_key=req.template_key,
            params=req.params,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return result


@router.get("/templates")
async def list_templates():
    """Список доступных шаблонов контента."""
    result = []
    for key, tmpl in CONTENT_TEMPLATES.items():
        # Parse required params from prompt template
        import re
        params = re.findall(r"\{(\w+)\}", tmpl["prompt"])
        # Remove standard params
        standard = {"name", "specialization", "city", "platform", "services_list",
                     "services_context", "profile_context"}
        custom_params = [p for p in set(params) if p not in standard]
        result.append(AITemplateInfo(
            key=key,
            name=tmpl["name"],
            required_params=custom_params,
        ))
    return result


@router.post("/transcribe", response_model=AITranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    master: Master = Depends(require_feature("ai_voice")),
):
    """STT — распознавание голосового сообщения через Whisper API."""
    max_size = 25 * 1024 * 1024  # 25 MB limit
    audio_bytes = await audio.read()
    if len(audio_bytes) > max_size:
        raise HTTPException(status_code=413, detail="Audio file too large (max 25 MB)")

    stt = get_stt_provider()
    try:
        transcript = await stt.transcribe(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.ogg",
        )
    except Exception as e:
        logger.error(f"STT transcription error: {e}")
        raise HTTPException(status_code=500, detail="Ошибка распознавания речи")

    return AITranscribeResponse(transcript=transcript)


@router.post("/voice-diary", response_model=AIVoiceDiaryResponse)
async def voice_diary(
    req: AIVoiceRequest,
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Голосовой дневник — мастер надиктовывает заметку, AI структурирует."""
    service = AIService(db)
    result = await service.process_voice_diary(
        master_id=master.id,
        transcript=req.transcript,
        client_id=req.client_id,
        appointment_id=req.appointment_id,
    )
    await db.commit()
    return result


@router.post("/client-message", response_model=AIClientMessageResponse)
async def client_message(
    req: AIClientMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    """AI отвечает клиенту от имени мастера (для ботов)."""
    from app.modules.core.models import FeatureFlags
    flags_result = await db.execute(
        select(FeatureFlags).where(FeatureFlags.master_id == req.master_id)
    )
    flags = flags_result.scalar_one_or_none()
    if not flags or not flags.ai_client_bot:
        raise HTTPException(status_code=403, detail="AI client bot не включён для этого мастера")

    service = AIService(db)
    response = await service.answer_client(
        master_id=req.master_id,
        client_id=req.client_id or 0,
        client_message=req.message,
    )
    return AIClientMessageResponse(response=response)


@router.post("/index", response_model=AIIndexResponse)
async def reindex_master(
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Принудительная переиндексация RAG базы мастера."""
    indexer = AIIndexer(db)
    count = await indexer.index_master(master.id)
    await db.commit()
    return AIIndexResponse(master_id=master.id, chunks_created=count)


@router.get("/tokens", response_model=AITokensInfoResponse)
async def get_tokens_info(
    master: Master = Depends(get_current_master),
    db: AsyncSession = Depends(get_db),
):
    """Информация о квоте AI-токенов мастера."""
    service = AIService(db)
    return await service.get_tokens_info(master.id)


@router.get("/voice-diary/entries")
async def get_voice_diary_entries(
    limit: int = 50,
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Список голосовых заметок мастера."""
    from app.modules.ai.models import VoiceSession
    result = await db.execute(
        select(VoiceSession)
        .where(VoiceSession.master_id == master.id)
        .order_by(VoiceSession.created_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "transcript": e.transcript,
            "structured_notes": e.ai_response or "",
            "client_name": None,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]
