"""
Messages REST API + WebSocket.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_current_master, decode_token
from app.core.database import get_db, async_session_factory
from app.modules.messages.models import MessageThread, Message
from app.modules.messages.schemas import (
    MessageCreate, MessageOut, ThreadOut,
    ThreadListOut, MessageListOut,
)
from app.modules.messages.service import MessagesService
from app.modules.masters.models import Master
from app.modules.clients.models import Client
from app.modules.notifications.service import NotificationService

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────

async def _get_master_and_client(user: dict, db: AsyncSession):
    """Определить master_id и client_id текущего пользователя."""
    identity_id = int(user["sub"])
    role = user.get("role", "")

    master_id = None
    client_id = None

    if role in ("master", "superadmin"):
        result = await db.execute(
            select(Master).where(Master.identity_id == identity_id)
        )
        master = result.scalar_one_or_none()
        if master:
            master_id = master.id

    if role in ("client", "superadmin"):
        result = await db.execute(
            select(Client).where(Client.identity_id == identity_id)
        )
        client = result.scalar_one_or_none()
        if client:
            client_id = client.id

    return master_id, client_id, role


def _check_thread_access(
    thread: MessageThread,
    master_id: Optional[int],
    client_id: Optional[int],
    role: str,
) -> str:
    """Проверить доступ к треду, вернуть viewer_role."""
    if role == "superadmin":
        return "master"
    if master_id and thread.master_id == master_id:
        return "master"
    if client_id and thread.client_id == client_id:
        return "client"
    raise HTTPException(status_code=403, detail="Access denied to this thread")


# ── Thread endpoints ─────────────────────────────────────────────

@router.get("/threads", response_model=ThreadListOut)
async def list_threads(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список тредов текущего пользователя."""
    master_id, client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    if master_id and role in ("master", "superadmin"):
        threads, total = await svc.list_threads_for_master(master_id, offset, limit)
        viewer_role = "master"
    elif client_id:
        threads, total = await svc.list_threads_for_client(client_id, offset, limit)
        viewer_role = "client"
    else:
        return ThreadListOut(items=[], total=0)

    items = [await svc.enrich_thread(t, viewer_role) for t in threads]
    return ThreadListOut(items=items, total=total)


@router.post("/threads/open", response_model=ThreadOut)
async def open_thread(
    client_id: Optional[int] = Query(None),
    master_id: Optional[int] = Query(None),
    appointment_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Открыть/создать тред с клиентом или мастером."""
    my_master_id, my_client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    if role in ("master", "superadmin") and my_master_id and client_id:
        thread = await svc.get_or_create_thread(my_master_id, client_id, appointment_id)
        viewer_role = "master"
    elif role == "client" and my_client_id and master_id:
        thread = await svc.get_or_create_thread(master_id, my_client_id, appointment_id)
        viewer_role = "client"
    else:
        raise HTTPException(status_code=400, detail="Missing client_id or master_id")

    await db.commit()
    return await svc.enrich_thread(thread, viewer_role)


@router.get("/threads/{thread_id}", response_model=MessageListOut)
async def get_thread_messages(
    thread_id: int,
    before_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить сообщения в треде + автоматически пометить прочитанными."""
    master_id, client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    thread = await svc.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    viewer_role = _check_thread_access(thread, master_id, client_id, role)

    # Помечаем прочитанными при открытии
    await svc.mark_as_read(thread_id, viewer_role)

    messages, total = await svc.list_messages(thread_id, before_id, limit)
    await db.commit()

    thread_data = await svc.enrich_thread(thread, viewer_role)
    return MessageListOut(
        items=[MessageOut.model_validate(m) for m in messages],
        total=total,
        thread=thread_data,
    )


@router.post("/threads/{thread_id}/messages", response_model=MessageOut)
async def send_message(
    thread_id: int,
    body: MessageCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить сообщение в тред."""
    if not body.text and not body.attachment_url:
        raise HTTPException(status_code=400, detail="Empty message")

    master_id, client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    thread = await svc.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    viewer_role = _check_thread_access(thread, master_id, client_id, role)
    sender_id = master_id if viewer_role == "master" else client_id

    msg = await svc.send_message(
        thread_id=thread_id,
        sender_role=viewer_role,
        sender_id=sender_id,
        text=body.text,
        attachment_url=body.attachment_url,
    )
    await db.commit()

    # Push-уведомление получателю
    try:
        preview = (body.text or "📎 Вложение")[:100]
        if viewer_role == "master":
            # Мастер написал → уведомляем клиента
            master_obj = await db.get(Master, master_id)
            sender_name = master_obj.display_name if master_obj else "Мастер"
            await NotificationService.send_by_client_id(
                db=db,
                client_id=thread.client_id,
                text=f"💬 {sender_name}: {preview}",
                button_text="Ответить",
                button_url=f"{_get_app_url()}?startParam=chat-{thread_id}",
            )
        else:
            # Клиент написал → уведомляем мастера
            client_obj = await db.get(Client, client_id)
            sender_name = client_obj.display_name if client_obj else "Клиент"
            await NotificationService.send_by_master_id(
                db=db,
                master_id=thread.master_id,
                text=f"💬 {sender_name}: {preview}",
                button_text="Ответить",
                button_url=f"{_get_app_url()}?startParam=chat-{thread_id}",
            )
    except Exception as e:
        logger.warning(f"Failed to send message notification: {e}")

    # Broadcast to WebSocket subscribers
    await _ws_broadcast(thread_id, MessageOut.model_validate(msg).model_dump_json())

    return MessageOut.model_validate(msg)


@router.post("/threads/{thread_id}/read")
async def mark_read(
    thread_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Пометить все сообщения в треде как прочитанные."""
    master_id, client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    thread = await svc.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    viewer_role = _check_thread_access(thread, master_id, client_id, role)
    count = await svc.mark_as_read(thread_id, viewer_role)
    await db.commit()
    return {"marked": count}


@router.get("/unread")
async def get_unread_count(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Общее количество непрочитанных сообщений."""
    master_id, client_id, role = await _get_master_and_client(user, db)
    svc = MessagesService(db)

    count = 0
    if master_id and role in ("master", "superadmin"):
        count = await svc.get_total_unread_master(master_id)
    elif client_id:
        count = await svc.get_total_unread_client(client_id)

    return {"unread": count}


# ── WebSocket ────────────────────────────────────────────────────

# In-memory connections: thread_id -> set of WebSocket
_ws_connections: dict[int, set[WebSocket]] = {}


async def _ws_broadcast(thread_id: int, message_json: str):
    """Отправить сообщение всем подписчикам треда."""
    conns = _ws_connections.get(thread_id, set())
    dead = set()
    for ws in conns:
        try:
            await ws.send_text(message_json)
        except Exception:
            dead.add(ws)
    conns -= dead


@router.websocket("/ws/{thread_id}")
async def websocket_chat(
    websocket: WebSocket,
    thread_id: int,
    token: str = Query(""),
):
    """
    WebSocket для real-time чата.
    Подключение: ws://api/api/v1/messages/ws/{thread_id}?token=JWT
    """
    # Аутентификация
    try:
        user = decode_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    # Проверяем доступ к треду
    async with async_session_factory() as db:
        master_id, client_id, role = await _get_master_and_client(user, db)
        svc = MessagesService(db)
        thread = await svc.get_thread(thread_id)
        if not thread:
            await websocket.close(code=4004, reason="Thread not found")
            return
        try:
            viewer_role = _check_thread_access(thread, master_id, client_id, role)
        except HTTPException:
            await websocket.close(code=4003, reason="Access denied")
            return
        sender_id = master_id if viewer_role == "master" else client_id

    # Регистрируем подключение
    if thread_id not in _ws_connections:
        _ws_connections[thread_id] = set()
    _ws_connections[thread_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = payload.get("type", "message")

            if msg_type == "message":
                text = payload.get("text", "").strip()
                attachment = payload.get("attachment_url")
                if not text and not attachment:
                    continue

                async with async_session_factory() as db:
                    svc = MessagesService(db)
                    msg = await svc.send_message(
                        thread_id=thread_id,
                        sender_role=viewer_role,
                        sender_id=sender_id,
                        text=text or None,
                        attachment_url=attachment,
                    )
                    await db.commit()
                    msg_out = MessageOut.model_validate(msg).model_dump_json()

                # Broadcast to all WS subscribers
                await _ws_broadcast(thread_id, msg_out)

                # Push notification (async, fire-and-forget)
                try:
                    async with async_session_factory() as db:
                        preview = (text or "📎 Вложение")[:100]
                        if viewer_role == "master":
                            master_obj = await db.get(Master, master_id)
                            name = master_obj.display_name if master_obj else "Мастер"
                            await NotificationService.send_by_client_id(
                                db=db,
                                client_id=thread.client_id,
                                text=f"💬 {name}: {preview}",
                                button_text="Ответить",
                                button_url=f"{_get_app_url()}?startParam=chat-{thread_id}",
                            )
                        else:
                            client_obj = await db.get(Client, client_id)
                            name = client_obj.display_name if client_obj else "Клиент"
                            await NotificationService.send_by_master_id(
                                db=db,
                                master_id=thread.master_id,
                                text=f"💬 {name}: {preview}",
                                button_text="Ответить",
                                button_url=f"{_get_app_url()}?startParam=chat-{thread_id}",
                            )
                except Exception as e:
                    logger.warning(f"WS push notification failed: {e}")

            elif msg_type == "read":
                async with async_session_factory() as db:
                    svc = MessagesService(db)
                    await svc.mark_as_read(thread_id, viewer_role)
                    await db.commit()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
    finally:
        _ws_connections.get(thread_id, set()).discard(websocket)
        if thread_id in _ws_connections and not _ws_connections[thread_id]:
            del _ws_connections[thread_id]


def _get_app_url() -> str:
    from app.core.config import settings
    return settings.APP_URL
