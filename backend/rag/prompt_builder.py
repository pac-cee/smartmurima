"""Builds grounded prompts and detects the query language (rw/en)."""
from __future__ import annotations

import re

SYSTEM_EN = (
    "You are SmartMurima, an agronomy assistant for smallholder farmers in "
    "Bugesera District, Rwanda. Answer ONLY using the provided context. If the "
    "answer is not in the context, say you do not know and suggest contacting a "
    "RAB/MINAGRI extension officer. Be concise and practical. Cite sources by "
    "their [n] number."
)

SYSTEM_RW = (
    "Uri SmartMurima, umufasha w'ubuhinzi ku bahinzi bato bo mu Karere ka "
    "Bugesera, mu Rwanda. Subiza WENYINE ukoresheje amakuru watanzwe. Niba "
    "igisubizo kitaboneka mu makuru, vuga ko utabizi kandi usabe guhamagara "
    "umujyanama wa RAB/MINAGRI. Ba mugufi kandi ufatika. Erekana inkomoko "
    "ukoresheje inomero [n]."
)

# A few common Kinyarwanda function words for lightweight language detection.
_RW_MARKERS = {
    "ni", "ubwo", "cyangwa", "muri", "kandi", "iyo", "gute", "ese", "amazi",
    "ubutaka", "imbuto", "ifumbire", "indwara", "ubuhinzi", "umuhinzi",
}


def detect_language(text: str, default: str = "en") -> str:
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    if tokens & _RW_MARKERS:
        return "rw"
    return default


class PromptBuilder:
    @staticmethod
    def build_context(sources: list[dict]) -> str:
        blocks = []
        for i, src in enumerate(sources, start=1):
            title = src.get("title", "Untitled")
            snippet = src.get("snippet") or src.get("content", "")
            blocks.append(f"[{i}] {title}\n{snippet}")
        return "\n\n".join(blocks) if blocks else "(no context found)"

    @classmethod
    def build_messages(
        cls, question: str, sources: list[dict], language: str
    ) -> list[dict]:
        system = SYSTEM_RW if language == "rw" else SYSTEM_EN
        context = cls.build_context(sources)
        user = f"Context:\n{context}\n\nQuestion: {question}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
