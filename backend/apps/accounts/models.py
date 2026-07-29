"""Accounts ORM models: custom User, Farmer profile, and OtpCode.

Models hold fields, constraints, Meta, and ``__str__`` only. No business logic.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.TextChoices):
    FARMER = "farmer", "Farmer"
    COOP_ADMIN = "coop_admin", "Cooperative Admin"
    EXTENSION = "extension", "Extension Officer"
    ADMIN = "admin", "Administrator"


class Language(models.TextChoices):
    KINYARWANDA = "rw", "Kinyarwanda"
    ENGLISH = "en", "English"


class UserManager(BaseUserManager):
    """Manager for the custom user model.

    NB: user *creation* business rules live in ``services.AuthService``; this
    manager only provides the primitives Django's auth framework requires.
    """

    use_in_migrations = True

    def _create_user(self, username, email, password, **extra):
        if not username:
            raise ValueError("The username must be set.")
        email = self.normalize_email(email) if email else email
        user = self.model(username=username, email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email=None, password=None, **extra):
        extra.setdefault("role", Role.FARMER)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra)

    def create_superuser(self, username, email=None, password=None, **extra):
        extra.setdefault("role", Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(username, email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user. Password is stored hashed by Django's auth (password_hash)."""

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.FARMER
    )
    language = models.CharField(
        max_length=2, choices=Language.choices, default=Language.KINYARWANDA
    )
    is_active = models.BooleanField(default=False)  # activated via OTP verify
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "accounts_user"
        constraints = [
            models.CheckConstraint(
                check=models.Q(role__in=[c[0] for c in Role.choices]),
                name="user_role_valid",
            ),
            models.CheckConstraint(
                check=models.Q(language__in=[c[0] for c in Language.choices]),
                name="user_language_valid",
            ),
        ]

    def __str__(self):
        return f"{self.username} ({self.role})"


class Farmer(models.Model):
    """1-1 profile extension for users acting as farmers."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="farmer_profile"
    )
    cooperative_name = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_farmer"

    def __str__(self):
        return f"Farmer<{self.user.username}>"


class OtpPurpose(models.TextChoices):
    REGISTER = "register", "Register"
    LOGIN = "login", "Login"
    RESET = "reset", "Password reset"


class OtpCode(models.Model):
    """A single-use, TTL'd, hashed one-time password."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="otp_codes",
        null=True,
        blank=True,
    )
    identifier = models.CharField(max_length=254, db_index=True)  # phone/email
    code_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=20, choices=OtpPurpose.choices)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_otp_code"
        indexes = [
            models.Index(fields=["identifier", "purpose", "consumed_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(purpose__in=[c[0] for c in OtpPurpose.choices]),
                name="otp_purpose_valid",
            ),
        ]

    def __str__(self):
        return f"OTP<{self.identifier}:{self.purpose}>"
