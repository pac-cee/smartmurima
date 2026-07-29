from rest_framework import serializers

from .models import ChatMessage, ChatSession, KnowledgeDocument


class ChatSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatSession
        fields = ["id", "title", "created_at"]
        read_only_fields = ["id", "created_at"]


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "session", "role", "content", "sources", "created_at"]
        read_only_fields = fields


class ChatRequestSerializer(serializers.Serializer):
    session = serializers.IntegerField(required=False, allow_null=True)
    question = serializers.CharField()
    language = serializers.ChoiceField(
        choices=["rw", "en"], required=False, allow_blank=True
    )

    def validate_question(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Question must not be empty.")
        return value


class SourceSerializer(serializers.Serializer):
    title = serializers.CharField()
    ref = serializers.CharField()
    snippet = serializers.CharField()


class ChatResponseSerializer(serializers.Serializer):
    answer = serializers.CharField()
    sources = SourceSerializer(many=True)
    session = serializers.IntegerField()


class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDocument
        fields = ["id", "title", "source", "content", "chunk_index", "created_at"]
        read_only_fields = ["id", "chunk_index", "created_at"]


class KnowledgeIngestSerializer(serializers.Serializer):
    title = serializers.CharField()
    source = serializers.CharField(required=False, allow_blank=True)
    content = serializers.CharField()
