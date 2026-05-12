"""
AIIndexer — строит RAG базу знаний для каждого мастера.

Что индексируется:
1. profile     — имя, специализация, город, bio, welcome
2. services    — названия, цены, длительность, описания
3. stats       — статистика за 30 дней (загрузка, топ-услуги)
4. reviews     — ключевые фразы из последних 20 отзывов
5. custom_doc  — PDF/TXT загруженные мастером
"""

import logging
from typing import List
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, func

from app.modules.ai.models import AIKnowledgeChunk
from app.modules.masters.models import Master
from app.modules.services.models import Service
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.reviews.models import ClientReview
from app.modules.ai.providers import get_embed_provider

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500


class AIIndexer:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.embed_provider = get_embed_provider()

    async def index_master(self, master_id: int) -> int:
        """
        Переиндексируем базу знаний мастера.
        Удаляем старые чанки, создаём новые.
        Возвращает количество созданных чанков.
        """
        master = await self.db.get(Master, master_id)
        if not master:
            return 0

        total_chunks = 0

        for source_type, build_fn in [
            ("profile", self._build_profile_chunks),
            ("services", self._build_services_chunks),
            ("stats", self._build_stats_chunks),
            ("reviews", self._build_reviews_chunks),
        ]:
            try:
                chunks_text = await build_fn(master_id)
                if chunks_text:
                    count = await self._save_chunks(
                        master_id, source_type, chunks_text
                    )
                    total_chunks += count
                    logger.debug(
                        f"Indexed {count} chunks ({source_type}) "
                        f"for master {master_id}"
                    )
            except Exception as e:
                logger.error(
                    f"Index error ({source_type}) for master {master_id}: {e}"
                )

        return total_chunks

    async def index_all_masters(self) -> int:
        """Переиндексировать всех мастеров. Запускается daily job."""
        result = await self.db.execute(
            select(Master.id).where(Master.is_active.is_(True))
        )
        master_ids = result.scalars().all()
        total = 0
        for mid in master_ids:
            total += await self.index_master(mid)
        logger.info(f"Reindexed {len(master_ids)} masters, {total} chunks total")
        return total

    async def search_chunks(
        self, master_id: int, query: str, top_k: int = 5
    ) -> List[str]:
        """Семантический поиск по базе знаний мастера."""
        query_embedding = await self.embed_provider.embed(query)

        result = await self.db.execute(
            select(AIKnowledgeChunk.content)
            .where(AIKnowledgeChunk.master_id == master_id)
            .order_by(
                AIKnowledgeChunk.embedding.cosine_distance(query_embedding)
            )
            .limit(top_k)
        )
        return [row[0] for row in result.all()]

    # ── Построение чанков ──────────────────────────────────────

    async def _build_profile_chunks(self, master_id: int) -> List[str]:
        master = await self.db.get(Master, master_id)
        if not master:
            return []
        parts = [
            f"Мастер: {master.display_name}",
            f"Специализация: {master.specialization or 'не указана'}",
            f"Город: {master.city or 'не указан'}",
        ]
        if master.description:
            parts.append(f"О себе: {master.description}")
        if master.address:
            parts.append(f"Адрес: {master.address}")
        parts.append(f"Рейтинг: {master.rating_avg} ({master.rating_count} отзывов)")
        return ["\n".join(parts)]

    async def _build_services_chunks(self, master_id: int) -> List[str]:
        result = await self.db.execute(
            select(Service).where(
                Service.master_id == master_id,
                Service.is_active.is_(True),
            )
        )
        services = result.scalars().all()
        chunks = []
        for svc in services:
            text = f"Услуга: {svc.name}, {svc.duration_min} мин, {svc.price}₽"
            if svc.price_max:
                text += f" (до {svc.price_max}₽)"
            if svc.description:
                text += f". {svc.description}"
            chunks.append(text)
        return chunks

    async def _build_stats_chunks(self, master_id: int) -> List[str]:
        now = datetime.now(timezone.utc)
        month_ago = now - timedelta(days=30)

        # Общие записи за 30 дней
        r1 = await self.db.execute(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.master_id == master_id,
                    Appointment.created_at >= month_ago,
                    Appointment.status == AppointmentStatus.COMPLETED.value,
                )
            )
        )
        completed_count = r1.scalar() or 0

        # Топ-3 услуги
        r2 = await self.db.execute(
            select(
                Appointment.service_id,
                func.count(Appointment.id).label("cnt"),
            )
            .where(
                and_(
                    Appointment.master_id == master_id,
                    Appointment.created_at >= month_ago,
                    Appointment.status == AppointmentStatus.COMPLETED.value,
                )
            )
            .group_by(Appointment.service_id)
            .order_by(func.count(Appointment.id).desc())
            .limit(3)
        )
        top_services_rows = r2.all()

        stats_text = f"Статистика за 30 дней: {completed_count} завершённых записей."
        if top_services_rows:
            top_ids = [str(row[0]) for row in top_services_rows if row[0]]
            stats_text += f" Топ услуг по ID: {', '.join(top_ids)}"

        return [stats_text]

    async def _build_reviews_chunks(self, master_id: int) -> List[str]:
        result = await self.db.execute(
            select(ClientReview)
            .where(
                ClientReview.master_id == master_id,
                ClientReview.is_hidden.is_(False),
            )
            .order_by(ClientReview.created_at.desc())
            .limit(20)
        )
        reviews = result.scalars().all()
        chunks = []
        for rev in reviews:
            if rev.text:
                chunks.append(f"Отзыв ({rev.rating}★): {rev.text[:CHUNK_SIZE]}")
        return chunks

    async def _save_chunks(
        self, master_id: int, source_type: str, texts: List[str]
    ) -> int:
        """Удалить старые чанки источника, создать новые с эмбеддингами."""
        await self.db.execute(
            delete(AIKnowledgeChunk).where(
                AIKnowledgeChunk.master_id == master_id,
                AIKnowledgeChunk.source_type == source_type,
            )
        )

        embeddings = await self.embed_provider.embed_batch(texts)

        for text, embedding in zip(texts, embeddings):
            chunk = AIKnowledgeChunk(
                master_id=master_id,
                source_type=source_type,
                content=text,
                embedding=embedding,
            )
            self.db.add(chunk)

        await self.db.flush()
        return len(texts)
