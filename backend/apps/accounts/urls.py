"""Auth & OTP routes, mounted under /api/v1/auth/."""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    MeView,
    OtpResendView,
    OtpVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)

app_name = "accounts"

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("otp/verify", OtpVerifyView.as_view(), name="otp-verify"),
    path("otp/resend", OtpResendView.as_view(), name="otp-resend"),
    path("login", LoginView.as_view(), name="login"),
    path("token/refresh", TokenRefreshView.as_view(), name="token-refresh"),
    path(
        "password/reset/request",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password/reset/confirm",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("me", MeView.as_view(), name="me"),
]
