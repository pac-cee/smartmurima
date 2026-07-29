"""Test settings: sqlite, fast password hashing, no external services."""
import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DJANGO_DEBUG", "True")

from .base import *  # noqa: F401,F403,E402
from .base import BASE_DIR  # noqa: E402

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Never hit a real SMS provider in tests -> console gateway.
SMS_PROVIDER = ""

CORS_ALLOW_ALL_ORIGINS = True
