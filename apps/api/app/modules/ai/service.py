"""
AIService — основной сервис AI-ассистента.

Режимы работы:
1. advisor   — советник для мастера (RAG + контекст бизнеса)
2. client    — ответы клиентам от имени мастера
3. content   — генерация постов и контента
4. voice     — обработка голосовых сообщений (голосовой дневник)
"""

import json
import logging
from typing import List, Optional, AsyncIterator, Dict, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.modules.ai.providers import get_ai_provider
from app.modules.ai.indexer import AIIndexer
from app.modules.ai.models import AIConversation, VoiceSession
from app.modules.masters.models import Master
from app.modules.services.models import Service
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.core.models import FeatureFlags

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 20

ADVISOR_SYSTEM_TEMPLATE = """Ты — персональный AI-ассистент мастера {name}.
Специализация: {specialization}. Город: {city}.

{services_context}

{stats_context}

{rag_context}

Правила:
- Отвечай конкретно и практично
- Предлагай действия, а не теорию
- Если вопрос про запись клиента — уточняй детали из системы
- Не выдумывай данные которых нет в контексте
- Язык: русский
- Тон: дружелюбный профессионал"""

CLIENT_SYSTEM_TEMPLATE = """Ты — виртуальный помощник мастера {name} ({specialization}).
Ты общаешься с клиентами от имени мастера.

{services_context}

{client_context}

Правила:
- Отвечай дружелюбно и кратко
- Можешь рассказать об услугах, ценах, расписании
- Для записи направляй клиента в приложение
- НЕ раскрывай личные данные других клиентов
- НЕ обещай скидок без указания мастера
- НЕ обсуждай темы вне специализации мастера
- Язык: русский"""

CONTENT_TEMPLATES = {
    "promo_post": {
        "name": "Пост об акции",
        "prompt": """Напиши продающий пост для {platform} об акции мастера {name}.

Акция: {promo_description}
Специализация: {specialization}

Требования:
- Длина: 800-1200 символов
- Стиль: живой, не сухой
- Включи призыв к действию
- Добавь 5-7 релевантных хэштегов
- Не используй шаблонные фразы типа "наш уютный кабинет"
""",
    },
    "introduction_post": {
        "name": "Пост-знакомство",
        "prompt": """Напиши пост-знакомство для {platform} мастера {name}.

{profile_context}

Требования:
- Длина: 600-1000 символов
- 3 варианта с разным акцентом:
  1. Фокус на опыт и профессионализм
  2. Фокус на атмосферу и отношение к клиентам
  3. Фокус на результат и трансформацию
- Каждый вариант с хэштегами
""",
    },
    "review_reply": {
        "name": "Ответ на отзыв",
        "prompt": """Напиши профессиональный ответ на отзыв клиента.

Мастер: {name} ({specialization})
Отзыв (оценка {rating}/5): "{review_text}"

Требования:
- Длина: 100-200 символов
- Тон соответствует оценке
- Если негативный — признай проблему, предложи решение
- Если позитивный — поблагодари искренне
- Без шаблонных фраз
""",
    },
    "seasonal_content": {
        "name": "Сезонный контент",
        "prompt": """Создай контент-план на {period} для мастера {name} ({specialization}).

Услуги: {services_list}

Формат:
- 5 идей постов с кратким описанием (2-3 предложения каждое)
- К каждой идее — лучший день/время для публикации
- Связь с сезонным событием или трендом
""",
    },
    "faq": {
        "name": "FAQ для профиля",
        "prompt": """Создай раздел FAQ для профиля мастера {name} ({specialization}).

{services_context}

Формат:
- 8-10 вопросов и ответов
- Реальные вопросы которые задают клиенты
- Ответы: конкретные, без воды, 1-3 предложения
- Охвати: запись, цены, длительность, подготовку, уход после
""",
    },
}


class AIService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = get_ai_provider()
        self.indexer = AIIndexer(db)

    # ─── Чат-советник (streaming) ─────────────────────────────────────
    async def chat_stream(
        self,
        master_id: int,
        session_id: str,
        user_message: str,
    ) -> AsyncIterator[str]:
        """
        Чат с AI-советником. Streaming через WebSocket.
        """
        await self._check_quota(master_id, estimated_tokens=1500)

        history = await self._get_chat_history(master_id, session_id)
        system_prompt = await self._build_advisor_prompt(master_id, user_message)

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        await self._save_message(
            master_id=master_id,
            session_id=session_id,
            role="user",
            content=user_message,
        )

        full_response = ""
        tokens_used = 0

        try:
            async for chunk in self.provider.chat_stream(
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            ):
                full_response += chunk
                tokens_used += len(chunk) // 4
                yield chunk
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"AI chat stream error: {e}")
            error_msg = "Извините, произошла ошибка. Попробуйте ещё раз."
            yield error_msg
            full_response = error_msg

        await self._save_message(
            master_id=master_id,
            session_id=session_id,
            role="assistant",
            content=full_response,
            tokens_used=tokens_used,
        )
        await self._consume_tokens(master_id, tokens_used)

    # ─── Чат-советник (синхронный, для POST /ai/ask) ─────────────────
    async def chat(
        self,
        master_id: int,
        session_id: str,
        user_message: str,
    ) -> dict:
        """Синхронный чат с AI-советником (без стриминга)."""
        await self._check_quota(master_id, estimated_tokens=1500)

        history = await self._get_chat_history(master_id, session_id)
        system_prompt = await self._build_advisor_prompt(master_id, user_message)

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        await self._save_message(
            master_id=master_id,
            session_id=session_id,
            role="user",
            content=user_message,
        )

        try:
            response = await self.provider.chat(
                messages=messages,
                temperature=0.7,
                max_tokens=1500,
            )
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            response = "Извините, произошла ошибка. Попробуйте ещё раз."

        tokens_used = len(response) // 4

        await self._save_message(
            master_id=master_id,
            session_id=session_id,
            role="assistant",
            content=response,
            tokens_used=tokens_used,
        )
        await self._consume_tokens(master_id, tokens_used)

        return {
            "response": response,
            "session_id": session_id,
            "tokens_used": tokens_used,
        }

    # ─── Ответ клиенту ────────────────────────────────────────────────
    async def answer_client(
        self,
        master_id: int,
        client_id: int,
        client_message: str,
    ) -> str:
        """AI отвечает клиенту от имени мастера (синхронный, для бота)."""
        await self._check_quota(master_id, estimated_tokens=500)

        system_prompt = await self._build_client_prompt(master_id, client_id)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": client_message},
        ]
        try:
            response = await self.provider.chat(
                messages=messages,
                temperature=0.6,
                max_tokens=500,
            )
        except Exception as e:
            logger.error(f"AI client answer error: {e}")
            return "Извините, не могу ответить прямо сейчас. Напишите мастеру напрямую."

        await self._consume_tokens(master_id, len(response) // 4)
        return response

    # ─── Генерация контента ───────────────────────────────────────────
    async def generate_content(
        self,
        master_id: int,
        template_key: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Генерация контента по шаблону."""
        await self._check_quota(master_id, estimated_tokens=2000)

        if template_key not in CONTENT_TEMPLATES:
            raise ValueError(f"Неизвестный шаблон: {template_key}")

        template = CONTENT_TEMPLATES[template_key]
        master = await self.db.get(Master, master_id)
        if not master:
            raise ValueError("Мастер не найден")

        base_params = {
            "name": master.display_name,
            "specialization": master.specialization or "мастер",
            "city": master.city or "России",
            "platform": params.get("platform", "Instagram/ВКонтакте"),
        }

        services_result = await self.db.execute(
            select(Service).where(
                Service.master_id == master_id,
                Service.is_active.is_(True),
            )
        )
        services = services_result.scalars().all()
        base_params["services_list"] = ", ".join(s.name for s in services)
        base_params["services_context"] = "\n".join(
            f"• {s.name}: {s.price}₽" for s in services
        )
        base_params["profile_context"] = f"Bio: {master.description or 'не указано'}"

        all_params = {**base_params, **params}

        try:
            prompt = template["prompt"].format(**all_params)
        except KeyError as e:
            raise ValueError(f"Не хватает параметра для шаблона: {e}")

        messages = [
            {
                "role": "system",
                "content": "Ты — профессиональный копирайтер для мастеров услуг красоты и благополучия в России.",
            },
            {"role": "user", "content": prompt},
        ]

        try:
            result = await self.provider.chat(
                messages=messages,
                temperature=0.8,
                max_tokens=2000,
            )
        except Exception as e:
            logger.error(f"Content generation error: {e}")
            raise

        tokens_used = len(result) // 4
        await self._consume_tokens(master_id, tokens_used)

        return {
            "template_key": template_key,
            "template_name": template["name"],
            "content": result,
            "tokens_used": tokens_used,
        }

    # ─── Голосовой дневник ────────────────────────────────────────────
    async def process_voice_diary(
        self,
        master_id: int,
        transcript: str,
        client_id: Optional[int] = None,
        appointment_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Мастер надиктовал заметку — AI структурирует и сохраняет в CRM.
        """
        await self._check_quota(master_id, estimated_tokens=500)

        extraction_prompt = f"""Проанализируй заметку мастера и извлеки структурированные данные.

Заметка: "{transcript}"

Ответь СТРОГО в JSON формате (без markdown блоков):
{{
  "physical_params": {{}},
  "preferences": {{}},
  "note_text": "текст заметки для сохранения",
  "suggested_days_until_next": null,
  "allergies": []
}}

Правила:
- physical_params: тип ногтей/кожи/волос, состояние, проблемы
- preferences: любимые цвета, длина, стиль, любимые услуги
- allergies: аллергены и противопоказания
- suggested_days_until_next: через сколько дней рекомендуется следующий визит (или null)
- note_text: краткий конспект заметки (1-2 предложения)
"""
        try:
            response = await self.provider.chat(
                messages=[{"role": "user", "content": extraction_prompt}],
                temperature=0.2,
                max_tokens=500,
            )
            clean = response.strip().strip("```json").strip("```").strip()
            extracted = json.loads(clean)
        except Exception as e:
            logger.error(f"Voice diary extraction error: {e}")
            extracted = {
                "physical_params": {},
                "preferences": {},
                "note_text": transcript[:300],
                "suggested_days_until_next": None,
                "allergies": [],
            }

        # Сохраняем VoiceSession
        vs = VoiceSession(
            master_id=master_id,
            client_id=client_id,
            transcript=transcript,
            ai_response=json.dumps(extracted, ensure_ascii=False),
            tokens_used=len(transcript) // 4,
        )
        self.db.add(vs)
        await self.db.flush()

        saved_to_client = False
        if client_id:
            saved_to_client = await self._save_voice_diary_to_crm(
                master_id, client_id, extracted, appointment_id
            )

        return {
            "transcript": transcript,
            "extracted": extracted,
            "saved_to_client": saved_to_client,
        }

    # ─── Контекст для запросов ────────────────────────────────────────

    async def _build_advisor_prompt(
        self, master_id: int, user_message: str
    ) -> str:
        """Системный промпт для советника с RAG-контекстом."""
        master = await self.db.get(Master, master_id)
        if not master:
            return "Ты — AI-ассистент мастера. Помогай с вопросами о бизнесе."

        # RAG: ищем релевантные чанки
        rag_chunks = await self.indexer.search_chunks(
            master_id=master_id,
            query=user_message,
            top_k=5,
        )
        rag_context = ""
        if rag_chunks:
            rag_context = "Контекст из базы знаний:\n" + "\n---\n".join(rag_chunks)

        # Услуги
        services_result = await self.db.execute(
            select(Service)
            .where(Service.master_id == master_id, Service.is_active.is_(True))
            .limit(10)
        )
        services = services_result.scalars().all()
        services_lines = [
            f"• {s.name}: {s.price}₽, {s.duration_min} мин" for s in services
        ]
        services_context = "Услуги:\n" + "\n".join(services_lines) if services_lines else ""

        # Статистика за 30 дней
        now = datetime.now(timezone.utc)
        month_ago = now - timedelta(days=30)
        visits_result = await self.db.execute(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.master_id == master_id,
                    Appointment.status == AppointmentStatus.COMPLETED.value,
                    Appointment.time_start >= month_ago,
                )
            )
        )
        visits_count = visits_result.scalar() or 0
        stats_context = f"Визитов за 30 дней: {visits_count}"

        return ADVISOR_SYSTEM_TEMPLATE.format(
            name=master.display_name,
            specialization=master.specialization or "мастер",
            city=master.city or "не указан",
            services_context=services_context,
            stats_context=stats_context,
            rag_context=rag_context,
        )

    async def _build_client_prompt(
        self, master_id: int, client_id: int
    ) -> str:
        """Системный промпт для ответа клиенту."""
        master = await self.db.get(Master, master_id)
        if not master:
            return "Помогай клиентам записаться на услуги."

        # Услуги
        services_result = await self.db.execute(
            select(Service).where(
                Service.master_id == master_id,
                Service.is_active.is_(True),
            )
        )
        services = services_result.scalars().all()
        services_context = "\n".join(
            f"• {s.name}: {s.price}₽, {s.duration_min} мин" for s in services
        )

        # Контекст клиента
        from app.modules.clients.models import Client, ClientMasterLink
        client_result = await self.db.execute(
            select(Client).where(Client.id == client_id)
        )
        client = client_result.scalar_one_or_none()
        client_context = ""
        if client:
            client_context = f"Клиент: {client.display_name}"
            link_result = await self.db.execute(
                select(ClientMasterLink).where(
                    ClientMasterLink.master_id == master_id,
                    ClientMasterLink.client_id == client_id,
                )
            )
            link = link_result.scalar_one_or_none()
            if link and link.visit_count:
                client_context += f", визитов: {link.visit_count}"

        return CLIENT_SYSTEM_TEMPLATE.format(
            name=master.display_name,
            specialization=master.specialization or "мастер",
            services_context=services_context,
            client_context=client_context,
        )

    async def _get_chat_history(
        self, master_id: int, session_id: str
    ) -> List[dict]:
        """Загружаем историю диалога."""
        result = await self.db.execute(
            select(AIConversation)
            .where(
                AIConversation.master_id == master_id,
                AIConversation.session_id == session_id,
            )
            .order_by(AIConversation.created_at.desc())
            .limit(MAX_HISTORY_MESSAGES)
        )
        rows = result.scalars().all()
        rows.reverse()
        return [{"role": r.role, "content": r.content} for r in rows]

    async def _save_message(
        self,
        master_id: int,
        session_id: str,
        role: str,
        content: str,
        tokens_used: Optional[int] = None,
    ):
        msg = AIConversation(
            master_id=master_id,
            session_id=session_id,
            role=role,
            content=content,
            tokens_used=tokens_used,
        )
        self.db.add(msg)
        await self.db.flush()

    async def _check_quota(self, master_id: int, estimated_tokens: int = 0):
        """Проверяем лимит AI-токенов ДО вызова AI."""
        flags = await self.db.get(FeatureFlags, master_id)
        if not flags:
            return

        monthly_limit = flags.ai_tokens_monthly or 0
        if monthly_limit <= 0:
            return

        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        )
        result = await self.db.execute(
            select(func.coalesce(func.sum(AIConversation.tokens_used), 0)).where(
                AIConversation.master_id == master_id,
                AIConversation.created_at >= month_start,
            )
        )
        used = result.scalar() or 0

        if used + estimated_tokens > monthly_limit:
            raise ValueError(
                f"Лимит AI-токенов исчерпан ({used}/{monthly_limit}). "
                f"Обновите тариф для увеличения лимита."
            )

    async def _consume_tokens(self, master_id: int, tokens: int):
        """Логируем фактическое использование токенов (после вызова AI)."""
        flags = await self.db.get(FeatureFlags, master_id)
        if not flags:
            return

        monthly_limit = flags.ai_tokens_monthly or 0
        if monthly_limit <= 0:
            return

        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0,
        )
        result = await self.db.execute(
            select(func.coalesce(func.sum(AIConversation.tokens_used), 0)).where(
                AIConversation.master_id == master_id,
                AIConversation.created_at >= month_start,
            )
        )
        used = result.scalar() or 0
        logger.debug(f"Master {master_id} consumed ~{tokens} tokens ({used}/{monthly_limit})")

    async def _save_voice_diary_to_crm(
        self,
        master_id: int,
        client_id: int,
        extracted: Dict[str, Any],
        appointment_id: Optional[int] = None,
    ) -> bool:
        """Сохранить результат голосового дневника в CRM клиента."""
        from app.modules.clients.models import ClientNote, ClientProfile
        try:
            note_text = extracted.get("note_text", "")
            if note_text:
                note = ClientNote(
                    master_id=master_id,
                    client_id=client_id,
                    text=note_text,
                    appointment_id=appointment_id,
                )
                self.db.add(note)

            profile_result = await self.db.execute(
                select(ClientProfile).where(ClientProfile.client_id == client_id)
            )
            profile = profile_result.scalar_one_or_none()
            if profile:
                if extracted.get("physical_params"):
                    existing = profile.physical_params or {}
                    existing.update(extracted["physical_params"])
                    profile.physical_params = existing
                if extracted.get("preferences"):
                    existing = profile.preferences or {}
                    existing.update(extracted["preferences"])
                    profile.preferences = existing
                if extracted.get("allergies"):
                    existing = profile.allergies or []
                    for a in extracted["allergies"]:
                        if a not in existing:
                            existing.append(a)
                    profile.allergies = existing

            await self.db.flush()
            return True
        except Exception as e:
            logger.error(f"Voice diary CRM save error: {e}")
            return False

    async def get_tokens_info(self, master_id: int) -> dict:
        flags = await self.db.get(FeatureFlags, master_id)

        used_this_month = 0
        try:
            month_start = datetime.now(timezone.utc).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0,
            )
            result = await self.db.execute(
                select(func.coalesce(func.sum(AIConversation.tokens_used), 0)).where(
                    AIConversation.master_id == master_id,
                    AIConversation.created_at >= month_start,
                )
            )
            used_this_month = result.scalar() or 0
        except Exception:
            pass

        return {
            "ai_enabled": flags.ai_advisor if flags else False,
            "ai_client_bot": flags.ai_client_bot if flags else False,
            "ai_voice": flags.ai_voice if flags else False,
            "tokens_monthly_limit": flags.ai_tokens_monthly if flags else 0,
            "tokens_used_this_month": used_this_month,
        }
