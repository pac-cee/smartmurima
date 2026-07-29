"""Assistant business logic: RAG orchestration and knowledge ingestion."""
from __future__ import annotations

from typing import Iterator, Optional

from django.db import transaction

from core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    ServiceUnavailableError,
    ValidationError,
)
from core.services import BaseService

from rag.chunking import chunk_text
from rag.client import OllamaClient
from rag.embeddings import EmbeddingService
from rag.prompt_builder import PromptBuilder, detect_language
from rag.retriever import Retriever

from .models import ChatSession, MessageRole
from .repositories import (
    ChatMessageRepository,
    ChatSessionRepository,
    KnowledgeDocumentRepository,
)

NO_ANSWER_EN = (
    "I could not find this in the SmartMurima knowledge base. Please contact a "
    "RAB/MINAGRI extension officer for guidance."
)
NO_ANSWER_RW = (
    "Sinabonye ibi mu bubiko bw'ubumenyi bwa SmartMurima. Nyamuneka uhamagare "
    "umujyanama wa RAB/MINAGRI."
)


class AssistantService(BaseService):
    def __init__(
        self,
        session_repo: Optional[ChatSessionRepository] = None,
        message_repo: Optional[ChatMessageRepository] = None,
        retriever: Optional[Retriever] = None,
        llm: Optional[OllamaClient] = None,
    ):
        self.session_repo = session_repo or ChatSessionRepository()
        self.message_repo = message_repo or ChatMessageRepository()
        self.retriever = retriever or Retriever()
        self.llm = llm or OllamaClient()

    # -- sessions ---------------------------------------------------------
    def list_sessions(self, user):
        return self.session_repo.list_for_user(user)

    def create_session(self, user, title: str = "") -> ChatSession:
        return self.session_repo.create(
            user=user, title=title or "New conversation"
        )

    def _get_owned_session(self, user, session_id) -> ChatSession:
        session = self.session_repo.get_by_id(session_id)
        if session is None:
            raise NotFoundError("Session not found.")
        if session.user_id != user.id and not (
            user.is_superuser or user.role == "admin"
        ):
            raise PermissionDeniedError("Not your session.")
        return session

    def list_messages(self, user, session_id):
        self._get_owned_session(user, session_id)
        return self.message_repo.for_session(session_id)

    # -- chat -------------------------------------------------------------
    def _resolve_session(self, user, session_id, question) -> ChatSession:
        if session_id:
            return self._get_owned_session(user, session_id)
        title = (question[:60] + "...") if len(question) > 60 else question
        return self.create_session(user, title=title)

    def _retrieve(self, question):
        return self.retriever.similarity_search(question)

    def answer(self, user, question: str, session_id=None, language: str = "") -> dict:
        question = (question or "").strip()
        if not question:
            raise ValidationError("Question must not be empty.")

        session = self._resolve_session(user, session_id, question)
        language = language or detect_language(question)
        sources = self._retrieve(question)

        # Persist the user turn.
        self.message_repo.create(
            session=session, role=MessageRole.USER, content=question, sources=[]
        )

        if not sources:
            # UC-20 E2: no relevant context -> say we don't know (never fabricate).
            answer = NO_ANSWER_RW if language == "rw" else NO_ANSWER_EN
        else:
            messages = PromptBuilder.build_messages(question, sources, language)
            llm_answer = self.llm.chat(messages)
            if llm_answer is None:
                # UC-20 E3/E4: context retrieved but the LLM (Ollama) is
                # unreachable -> surface a 503 rather than a fabricated answer.
                raise ServiceUnavailableError(
                    "The AI assistant is temporarily unavailable. Please try again "
                    "shortly.",
                    code="assistant_unavailable",
                )
            answer = llm_answer or (
                NO_ANSWER_RW if language == "rw" else NO_ANSWER_EN
            )

        source_refs = [
            {"title": s["title"], "ref": s["ref"], "snippet": s["snippet"]}
            for s in sources
        ]
        self.message_repo.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=answer,
            sources=source_refs,
        )
        return {"answer": answer, "sources": source_refs, "session": session.id}

    def stream_answer(
        self, user, question: str, session_id=None, language: str = ""
    ) -> Iterator[str]:
        """Yield SSE-formatted events. Persists the full turn on completion."""
        question = (question or "").strip()
        if not question:
            raise ValidationError("Question must not be empty.")

        session = self._resolve_session(user, session_id, question)
        language = language or detect_language(question)
        sources = self._retrieve(question)
        self.message_repo.create(
            session=session, role=MessageRole.USER, content=question, sources=[]
        )
        source_refs = [
            {"title": s["title"], "ref": s["ref"], "snippet": s["snippet"]}
            for s in sources
        ]

        yield _sse({"type": "session", "session": session.id})
        yield _sse({"type": "sources", "sources": source_refs})

        collected = []
        if not sources:
            # UC-20 E2: no context -> honest "don't know".
            fallback = NO_ANSWER_RW if language == "rw" else NO_ANSWER_EN
            collected.append(fallback)
            yield _sse({"type": "token", "token": fallback})
        else:
            messages = PromptBuilder.build_messages(question, sources, language)
            got_any = False
            for token in self.llm.chat_stream(messages):
                got_any = True
                collected.append(token)
                yield _sse({"type": "token", "token": token})
            if not got_any:
                # UC-20 E3: LLM unreachable mid-stream -> emit an error event
                # (HTTP status is already 200 for the SSE channel) and persist a
                # note rather than a fabricated answer.
                collected.append("")
                yield _sse(
                    {
                        "type": "error",
                        "code": "assistant_unavailable",
                        "message": "The AI assistant is temporarily unavailable.",
                    }
                )

        answer = "".join(collected)
        self.message_repo.create(
            session=session,
            role=MessageRole.ASSISTANT,
            content=answer,
            sources=source_refs,
        )
        yield _sse({"type": "done"})


class KnowledgeService(BaseService):
    def __init__(
        self,
        repo: Optional[KnowledgeDocumentRepository] = None,
        embedder: Optional[EmbeddingService] = None,
    ):
        self.repo = repo or KnowledgeDocumentRepository()
        self.embedder = embedder or EmbeddingService()

    def list_documents(self):
        return self.repo.all()

    @transaction.atomic
    def ingest_document(
        self, title: str, source: str, content: str,
        chunk_size: int = 800, overlap: int = 120,
    ) -> int:
        if not content.strip():
            raise ValidationError("Document content is empty.")
        source = source or title
        self.repo.clear_source(source)
        chunks = chunk_text(content, chunk_size=chunk_size, overlap=overlap)
        for chunk in chunks:
            embedding = self.embedder.embed(chunk.text)
            self.repo.upsert_chunk(
                title=title,
                source=source,
                content=chunk.text,
                chunk_index=chunk.index,
                embedding=embedding,
            )
        return len(chunks)

    def reembed_all(self) -> int:
        count = 0
        for doc in self.repo.all():
            doc.embedding = self.embedder.embed(doc.content)
            doc.save(update_fields=["embedding"])
            count += 1
        return count


def _sse(data: dict) -> str:
    import json

    return f"data: {json.dumps(data)}\n\n"
