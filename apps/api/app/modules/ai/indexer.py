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
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete, func

from app.modules.ai.models import AIKnowledgeChunk
from app.modules.masters.models import Master
from app.modules.services.models import Service
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.reviews.models import ClientReview
from app.modules.ai.providers import get_embed_provider
from app.modules.ai.chunking import chunk_paragraphs

logger = logging.getLogger(__name__)

# Размер чанка по умолчанию (совпадает с chunking.DEFAULT_CHUNK_SIZE).
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
# Максимум чанков, которые отправляем в embed_batch за один вызов.
EMBED_BATCH_SIZE = 64


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
        head_parts = [
            f"Мастер: {master.display_name}",
            f"Специализация: {master.specialization or 'не указана'}",
            f"Город: {master.city or 'не указан'}",
        ]
        if master.address:
            head_parts.append(f"Адрес: {master.address}")
        head_parts.append(
            f"Рейтинг: {master.rating_avg} ({master.rating_count} отзывов)"
        )
        header = "\n".join(head_parts)

        bio_text: Optional[str] = (master.description or "").strip() or None
        welcome_text: Optional[str] = (
            getattr(master, "welcome_message", None) or ""
        ).strip() or None

        if not bio_text and not welcome_text:
            return [header]

        chunks: List[str] = [header]
        if bio_text:
            for body in chunk_paragraphs(
                bio_text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP
            ):
                chunks.append(f"О мастере: {body}")
        if welcome_text:
            for body in chunk_paragraphs(
                welcome_text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP
            ):
                chunks.append(f"Приветствие клиенту: {body}")
        return chunks

    async def _build_services_chunks(self, master_id: int) -> List[str]:
        result = await self.db.execute(
            select(Service).where(
                Service.master_id == master_id,
                Service.is_active.is_(True),
            )
        )
        services = result.scalars().all()
        chunks: List[str] = []
        for svc in services:
            head = f"Услуга: {svc.name}, {svc.duration_min} мин, {svc.price}₽"
            if svc.price_max:
                head += f" (до {svc.price_max}₽)"
            description = (svc.description or "").strip()
            if not description:
                chunks.append(head)
                continue
            if len(head) + 2 + len(description) <= CHUNK_SIZE:
                chunks.append(f"{head}. {description}")
                continue
            # Длинное описание — дробим, повторяя заголовок в каждом чанке.
            for body in chunk_paragraphs(
                description,
                chunk_size=max(CHUNK_SIZE - len(head) - 2, 200),
                overlap=CHUNK_OVERLAP,
            ):
                chunks.append(f"{head}. {body}")
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
        chunks: List[str] = []
        for rev in reviews:
            text = (rev.text or "").strip()
            if not text:
                continue
            head = f"Отзыв ({rev.rating}★):"
            if len(head) + 1 + len(text) <= CHUNK_SIZE:
                chunks.append(f"{head} {text}")
                continue
            for body in chunk_paragraphs(
                text,
                chunk_size=max(CHUNK_SIZE - len(head) - 1, 200),
                overlap=CHUNK_OVERLAP,
            ):
                chunks.append(f"{head} {body}")
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
        if not texts:
            await self.db.flush()
            return 0

        embeddings = await self._embed_in_batches(texts)

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

    async def _embed_in_batches(self, texts: List[str]) -> List[List[float]]:
        """Батчим эмбеддинги, чтобы не упираться в лимиты провайдера."""
        out: List[List[float]] = []
        for i in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[i:i + EMBED_BATCH_SIZE]
            embeddings = await self.embed_provider.embed_batch(batch)
            out.extend(embeddings)
        return out

    async def index_custom_document(
        self,
        master_id: int,
        doc_id: int,
        filename: str,
        text: str,
    ) -> int:
        """
        Индексирует загруженный PDF/TXT документ в RAG.
        Чанки source_type='custom_doc' не трогаются в index_master(),
        их жизненный цикл привязан к AICustomDocument.
        Возвращает количество созданных чанков.
        """
        chunks_text = chunk_paragraphs(
            text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP
        )
        if not chunks_text:
            return 0

        embeddings = await self._embed_in_batches(chunks_text)
        for idx, (body, embedding) in enumerate(zip(chunks_text, embeddings)):
            chunk = AIKnowledgeChunk(
                master_id=master_id,
                source_type="custom_doc",
                content=body,
                embedding=embedding,
                metadata_={
                    "doc_id": doc_id,
                    "filename": filename,
                    "chunk_idx": idx,
                },
            )
            self.db.add(chunk)
        await self.db.flush()
        return len(chunks_text)

    async def delete_custom_document_chunks(
        self, master_id: int, doc_id: int
    ) -> int:
        """Удаляет все RAG-чанки конкретного пользовательского документа."""
        result = await self.db.execute(
            delete(AIKnowledgeChunk).where(
                AIKnowledgeChunk.master_id == master_id,
                AIKnowledgeChunk.source_type == "custom_doc",
                AIKnowledgeChunk.metadata_["doc_id"].as_integer() == doc_id,
            )
        )
        return result.rowcount or 0
