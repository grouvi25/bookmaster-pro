"""
RAG chunking utilities.

Делим длинные тексты на чанки фиксированного размера с overlap.
По возможности режем на границе абзаца или предложения, чтобы не
разрывать смысл посреди слова.
"""

from __future__ import annotations

import re
from typing import List

# Размер чанка в символах. ~200-250 токенов для русского текста.
DEFAULT_CHUNK_SIZE = 800
# Overlap между соседними чанками (для сохранения контекста на стыках).
DEFAULT_OVERLAP = 120

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[\.\!\?\n])\s+")
_PARAGRAPH_SPLIT_RE = re.compile(r"\n{2,}")


def normalize_text(text: str) -> str:
    """Приводит whitespace к каноничному виду, оставляя структуру абзацев."""
    if not text:
        return ""
    # Унифицируем переводы строк.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Сворачиваем горизонтальные пробелы.
    text = re.sub(r"[ \t]+", " ", text)
    # Не больше двух подряд переводов строк (граница абзаца).
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_into_chunks(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> List[str]:
    """
    Разбивает текст на чанки длиной до `chunk_size` символов c overlap.

    Алгоритм:
    1. Нормализуем whitespace.
    2. Если текст короткий — возвращаем как один чанк.
    3. Иначе идём sliding-window: для каждой позиции берём окно
       размером chunk_size, затем сдвигаем границу до ближайшего
       конца предложения (если он есть в последних `chunk_size//4`
       символах окна). Следующее окно стартует на (end - overlap).
    """
    text = normalize_text(text)
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    if overlap < 0:
        overlap = 0
    if overlap >= chunk_size:
        overlap = chunk_size // 4

    chunks: List[str] = []
    start = 0
    n = len(text)
    # Сколько символов в конце окна мы готовы отдать, чтобы найти
    # границу предложения.
    tail_search = max(chunk_size // 4, 50)

    while start < n:
        end = min(start + chunk_size, n)
        if end < n:
            # Ищем перенос абзаца, точку/!/? в хвосте окна.
            window_tail = text[max(end - tail_search, start):end]
            cut_offset = None
            # 1) Граница абзаца.
            para_match = list(_PARAGRAPH_SPLIT_RE.finditer(window_tail))
            if para_match:
                cut_offset = para_match[-1].end()
            else:
                # 2) Конец предложения.
                sent_match = list(_SENTENCE_SPLIT_RE.finditer(window_tail))
                if sent_match:
                    cut_offset = sent_match[-1].end()
            if cut_offset is not None:
                end = max(end - tail_search, start) + cut_offset
            else:
                # 3) Хотя бы по пробелу, чтобы не резать слово.
                space_idx = text.rfind(" ", start, end)
                if space_idx > start + chunk_size // 2:
                    end = space_idx
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def chunk_paragraphs(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> List[str]:
    """
    Разбивает текст сначала по абзацам, потом склеивает соседние
    короткие абзацы до примерно `chunk_size`. Длинные абзацы режутся
    через `split_into_chunks`.
    """
    text = normalize_text(text)
    if not text:
        return []
    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT_RE.split(text) if p.strip()]
    if not paragraphs:
        return []

    chunks: List[str] = []
    buffer: List[str] = []
    buffer_len = 0
    for para in paragraphs:
        if len(para) >= chunk_size:
            # Сначала сбрасываем buffer.
            if buffer:
                chunks.append("\n\n".join(buffer))
                buffer = []
                buffer_len = 0
            chunks.extend(split_into_chunks(para, chunk_size=chunk_size, overlap=overlap))
            continue
        # +2 за разделитель "\n\n".
        if buffer_len + len(para) + 2 > chunk_size and buffer:
            chunks.append("\n\n".join(buffer))
            buffer = [para]
            buffer_len = len(para)
        else:
            buffer.append(para)
            buffer_len += len(para) + 2
    if buffer:
        chunks.append("\n\n".join(buffer))
    return chunks
