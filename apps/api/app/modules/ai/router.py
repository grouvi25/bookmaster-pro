"""
AI router — WebSocket чат, голосовой дневник, STT, контент-мастер, клиентский бот.
"""

import uuid
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_master
from app.core.feature_flags import require_feature
from app.modules.ai.service import AIService, CONTENT_TEMPLATES
from app.modules.ai.providers import get_stt_provider
from app.modules.ai.indexer import AIIndexer
from app.modules.ai.documents import (
    DocumentValidationError,
    MAX_DOC_SIZE,
    delete_from_s3,
    process_uploaded_document,
)
from app.modules.ai.models import AICustomDocument
from app.modules.ai.schemas import (
    AIContentRequest,
    AIContentResponse,
    AIDocumentOut,
    AIDocumentUploadResponse,
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


# ── RAG: custom documents (PDF / TXT) ─────────────────────────

def _doc_to_out(doc: AICustomDocument) -> AIDocumentOut:
    return AIDocumentOut(
        id=doc.id,
        filename=doc.filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        pages_count=doc.pages_count,
        chars_count=doc.chars_count,
        chunks_count=doc.chunks_count or 0,
        status=doc.status,
        error=doc.error,
        created_at=doc.created_at,
    )


@router.post(
    "/knowledge/docs",
    response_model=AIDocumentUploadResponse,
    status_code=201,
)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """
    Загрузить PDF/TXT в RAG-базу знаний мастера.
    Максимум {MAX_DOC_SIZE // (1024 * 1024)} MB. Работает синхронно:
    файл извлекается → чанкуется → эмбеддится → уходит в ai_knowledge_chunks.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Пустой файл.")
    if len(raw) > MAX_DOC_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой (макс {MAX_DOC_SIZE // (1024 * 1024)} MB).",
        )

    try:
        doc, chunks_created = await process_uploaded_document(
            db,
            master_id=master.id,
            raw_bytes=raw,
            filename=file.filename or "document",
            mime_type=file.content_type or "",
        )
    except DocumentValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI document upload failed: %s", e)
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Не удалось обработать документ.",
        )

    await db.commit()
    await db.refresh(doc)
    return AIDocumentUploadResponse(
        document=_doc_to_out(doc),
        chunks_created=chunks_created,
    )


@router.get("/knowledge/docs", response_model=List[AIDocumentOut])
async def list_knowledge_documents(
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Список загруженных мастером документов в RAG-базе."""
    result = await db.execute(
        select(AICustomDocument)
        .where(AICustomDocument.master_id == master.id)
        .order_by(AICustomDocument.created_at.desc())
    )
    return [_doc_to_out(d) for d in result.scalars().all()]


@router.delete("/knowledge/docs/{doc_id}", status_code=204)
async def delete_knowledge_document(
    doc_id: int,
    master: Master = Depends(require_feature("ai_advisor")),
    db: AsyncSession = Depends(get_db),
):
    """Удалить документ и все его RAG-чанки."""
    result = await db.execute(
        select(AICustomDocument).where(
            AICustomDocument.id == doc_id,
            AICustomDocument.master_id == master.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден.")

    indexer = AIIndexer(db)
    await indexer.delete_custom_document_chunks(master.id, doc.id)

    s3_key = doc.s3_key
    await db.delete(doc)
    await db.commit()

    # Удаление файла из S3 — best-effort, после коммита.
    await delete_from_s3(s3_key)
    return Response(status_code=204)
