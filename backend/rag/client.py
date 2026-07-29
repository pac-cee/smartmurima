"""Thin Ollama HTTP client. All network use is optional and guarded.

If Ollama is unreachable the caller decides how to degrade (the assistant
returns an honest "service unavailable"/"cannot answer" message).
"""
from __future__ import annotations

import json
import logging
from typing import Iterator, Optional

from django.conf import settings

logger = logging.getLogger("smartmurima")


class OllamaClient:
    def __init__(self, host: Optional[str] = None, timeout: int = 120):
        self.host = (host or settings.OLLAMA_HOST).rstrip("/")
        self.timeout = timeout

    # -- embeddings -------------------------------------------------------
    def embed(self, text: str, model: Optional[str] = None) -> Optional[list[float]]:
        model = model or settings.EMBED_MODEL
        try:
            import requests

            resp = requests.post(
                f"{self.host}/api/embeddings",
                json={"model": model, "prompt": text},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("embedding")
        except Exception as exc:
            logger.warning("Ollama embed failed: %s", exc)
            return None

    # -- chat -------------------------------------------------------------
    def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> Optional[str]:
        model = model or settings.LLM_MODEL
        try:
            import requests

            resp = requests.post(
                f"{self.host}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")
        except Exception as exc:
            logger.warning("Ollama chat failed: %s", exc)
            return None

    def chat_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> Iterator[str]:
        """Yield content tokens as they arrive. Yields nothing on failure."""
        model = model or settings.LLM_MODEL
        try:
            import requests

            with requests.post(
                f"{self.host}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "options": {"temperature": temperature},
                },
                timeout=self.timeout,
                stream=True,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line:
                        continue
                    try:
                        payload = json.loads(line.decode("utf-8"))
                    except ValueError:
                        continue
                    token = payload.get("message", {}).get("content")
                    if token:
                        yield token
                    if payload.get("done"):
                        break
        except Exception as exc:
            logger.warning("Ollama stream failed: %s", exc)
            return
