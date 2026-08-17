"""Accounts serializers: (de)serialization + input validation."""
from rest_framework import serializers

from apps.locations.models import Location

from .models import Language, User


class UserSerializer(serializers.ModelSerializer):
    # ``location`` lives on the 1-1 Farmer profile, surfaced here for the
    # ``/auth/me`` contract. Read-only on this serializer; updates flow through
    # ProfileUpdateSerializer + AuthService.
    location = serializers.SerializerMethodField()
    location_path = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "phone_number",
            "role",
            "language",
            "is_active",
            "location",
            "location_path",
            "created_at",
        ]
        read_only_fields = ["id", "username", "is_active", "created_at", "role"]

    def _profile_location(self, obj):
        profile = getattr(obj, "farmer_profile", None)
        return profile.location if profile else None

    def get_location(self, obj):
        loc = self._profile_location(obj)
        return loc.id if loc else None

    def get_location_path(self, obj):
        loc = self._profile_location(obj)
        return loc.full_path if loc else None


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    password = serializers.CharField(min_length=8, write_only=True)
    language = serializers.ChoiceField(
        choices=Language.choices, default=Language.KINYARWANDA
    )
    # Optional: the location (sector) the farmer is connected to.
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), required=False, allow_null=True
    )

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone_number"):
            raise serializers.ValidationError(
                "Provide either an email or a phone number."
            )
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    """Input for PATCH /auth/me (partial). All fields optional."""

    full_name = serializers.CharField(max_length=255, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    language = serializers.ChoiceField(choices=Language.choices, required=False)
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.all(), required=False, allow_null=True
    )


class OtpVerifySerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    code = serializers.CharField(max_length=12)

    def validate(self, attrs):
        if not attrs.get("phone_number") and not attrs.get("email"):
            raise serializers.ValidationError("Provide a phone_number or email.")
        return attrs

    @property
    def identifier(self):
        return self.validated_data.get("phone_number") or self.validated_data.get(
            "email"
        )


class OtpResendSerializer(serializers.Serializer):
    phone_number = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    purpose = serializers.ChoiceField(
        choices=["register", "login", "reset"], default="register"
    )

    def validate(self, attrs):
        if not attrs.get("phone_number") and not attrs.get("email"):
            raise serializers.ValidationError("Provide a phone_number or email.")
        return attrs

    @property
    def identifier(self):
        return self.validated_data.get("phone_number") or self.validated_data.get(
            "email"
        )


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("phone_number") and not attrs.get("email"):
            raise serializers.ValidationError("Provide a phone_number or email.")
        return attrs

    @property
    def identifier(self):
        return self.validated_data.get("phone_number") or self.validated_data.get(
            "email"
        )


class PasswordResetConfirmSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    code = serializers.CharField(max_length=12)
    new_password = serializers.CharField(min_length=8, write_only=True)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class AuthResultSerializer(serializers.Serializer):
    user = UserSerializer()
    tokens = TokenPairSerializer()


class AdminUserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(min_length=8, write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "phone_number",
            "role",
            "language",
            "is_active",
            "password",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
