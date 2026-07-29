"""Text chunking with overlap for RAG ingestion."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Chunk:
    index: int
    text: str


def _normalize(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text.replace("\r\n", "\n")).strip()


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> list[Chunk]:
    """Split text into overlapping character windows on paragraph/sentence-ish
    boundaries. Overlap preserves context across chunk edges.
    """
    text = _normalize(text)
    if not text:
        return []
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    overlap = max(0, min(overlap, chunk_size - 1))

    chunks: list[Chunk] = []
    start = 0
    idx = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        # try to break on a sentence/paragraph boundary near the end
        window = text[start:end]
        if end < n:
            boundary = max(window.rfind(". "), window.rfind("\n"))
            if boundary > chunk_size * 0.5:
                end = start + boundary + 1
                window = text[start:end]
        chunk = window.strip()
        if chunk:
            chunks.append(Chunk(index=idx, text=chunk))
            idx += 1
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks
