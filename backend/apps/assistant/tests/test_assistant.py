"""UT-05: assistant empty-question rejected; IT-05: RAG -> Ollama path (mocked)."""
import pytest

from apps.accounts.models import User
from apps.assistant.models import ChatMessage
from apps.assistant.services import AssistantService
from core.exceptions import ValidationError


class FakeRetriever:
    def __init__(self, sources):
        self._sources = sources

    def similarity_search(self, query, k=None):
        return self._sources


class FakeLLM:
    def __init__(self, answer):
        self._answer = answer
        self.calls = []

    def chat(self, messages, model=None, temperature=0.2):
        self.calls.append(messages)
        return self._answer

    def chat_stream(self, messages, model=None, temperature=0.2):
        yield self._answer


@pytest.fixture
def user(db):
    return User.objects.create(username="u", full_name="U", role="farmer",
                               is_active=True)


def test_empty_question_rejected(db, user):
    # UT-05: empty question -> ValidationError (surfaces as HTTP 400).
    service = AssistantService(retriever=FakeRetriever([]), llm=FakeLLM("x"))
    with pytest.raises(ValidationError):
        service.answer(user, question="   ")


def test_rag_answer_grounded_with_sources(db, user):
    # IT-05: retrieved context is fed to the LLM; answer + sources persisted.
    sources = [
        {"title": "Maize irrigation", "ref": "rab#0",
         "snippet": "Irrigate below 25% moisture.",
         "content": "Irrigate below 25% moisture."}
    ]
    llm = FakeLLM("Irrigate when soil moisture is below 25%. [1]")
    service = AssistantService(retriever=FakeRetriever(sources), llm=llm)

    result = service.answer(user, question="When should I irrigate maize?",
                            language="en")

    assert "25%" in result["answer"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["title"] == "Maize irrigation"
    # Both the user turn and the assistant turn are persisted.
    assert ChatMessage.objects.filter(session_id=result["session"]).count() == 2
    # The LLM received the retrieved context in its prompt.
    prompt_text = str(llm.calls[0])
    assert "Irrigate below 25% moisture." in prompt_text


def test_no_context_returns_honest_fallback(db, user):
    # Grounding: with no retrieved context, never fabricate an answer.
    service = AssistantService(retriever=FakeRetriever([]), llm=FakeLLM("should not be used"))
    result = service.answer(user, question="Unknown topic?", language="en")
    assert "knowledge base" in result["answer"].lower()
    assert result["sources"] == []
