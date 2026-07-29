"""Development settings."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True

# Allow overriding the DB with a local sqlite for quick checks / CI when no
# Postgres is available. Set DJANGO_USE_SQLITE=1 to enable.
if env.bool("DJANGO_USE_SQLITE", default=False):
    DATABASES = {  # noqa: F811
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
        }
    }

CORS_ALLOW_ALL_ORIGINS = True
