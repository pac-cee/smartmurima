"""Accounts controllers: thin DRF views delegating to services."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView  # noqa: F401 (re-export)

from core.permissions import IsAdmin

from .models import User
from .serializers import (
    AdminUserWriteSerializer,
    AuthResultSerializer,
    LoginSerializer,
    OtpResendSerializer,
    OtpVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import AuthService


def _issue_payload(result):
    payload = {
        "identifier": result.identifier,
        "purpose": result.purpose,
        "expires_at": result.expires_at,
        "detail": "Verification code sent.",
    }
    if result.dev_code is not None:
        payload["dev_code"] = result.dev_code  # dev/console gateway only
    return payload


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    @extend_schema(request=RegisterSerializer)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthService().register(serializer.validated_data)
        return Response(_issue_payload(result), status=status.HTTP_201_CREATED)


class OtpVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp"

    @extend_schema(request=OtpVerifySerializer, responses=AuthResultSerializer)
    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthService().verify_registration(
            serializer.identifier, serializer.validated_data["code"]
        )
        return Response(
            {
                "user": UserSerializer(result["user"]).data,
                "tokens": result["tokens"],
            }
        )


class OtpResendView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp"

    @extend_schema(request=OtpResendSerializer)
    def post(self, request):
        serializer = OtpResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthService().resend_otp(
            serializer.identifier, serializer.validated_data["purpose"]
        )
        return Response(_issue_payload(result))


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    @extend_schema(request=LoginSerializer, responses=AuthResultSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthService().login(
            serializer.validated_data["identifier"],
            serializer.validated_data["password"],
        )
        return Response(
            {
                "user": UserSerializer(result["user"]).data,
                "tokens": result["tokens"],
            }
        )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp"

    @extend_schema(request=PasswordResetRequestSerializer)
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = AuthService().request_password_reset(serializer.identifier)
        return Response(_issue_payload(result))


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    @extend_schema(request=PasswordResetConfirmSerializer)
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AuthService().confirm_password_reset(
            serializer.validated_data["identifier"],
            serializer.validated_data["code"],
            serializer.validated_data["new_password"],
        )
        return Response({"detail": "Password updated. You can now sign in."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request):
        serializer = UserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = AuthService().update_profile(request.user, serializer.validated_data)
        return Response(UserSerializer(user).data)


class UserAdminViewSet(viewsets.ModelViewSet):
    """Admin CRUD over users -> /admin-api/users."""

    queryset = User.objects.all().order_by("-created_at")
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return UserSerializer
        return AdminUserWriteSerializer
