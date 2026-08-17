"""Base settings shared across environments.

Configuration is driven by environment variables via ``django-environ`` so the
same image runs in dev, prod, and CI. See ``.env.example`` for the full list.
"""
from datetime import timedelta
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000"]),
    JWT_ACCESS_MINUTES=(int, 30),
    JWT_REFRESH_DAYS=(int, 7),
    OTP_TTL_SECONDS=(int, 300),
    OTP_LENGTH=(int, 6),
    OTP_MAX_ATTEMPTS=(int, 5),
    OTP_RESEND_COOLDOWN_SECONDS=(int, 60),
    SMS_PROVIDER=(str, ""),
    SMS_API_KEY=(str, ""),
    SMS_SENDER_ID=(str, "SmartMurima"),
    MQTT_HOST=(str, "mqtt"),
    MQTT_PORT=(int, 1883),
    MQTT_TOPIC=(str, "smartmurima/+/telemetry"),
    OLLAMA_HOST=(str, "http://ollama:11434"),
    LLM_MODEL=(str, "llama3.1:8b"),
    EMBED_MODEL=(str, "nomic-embed-text"),
    RAG_TOP_K=(int, 4),
    EMBED_DIM=(int, 768),
    WEATHER_API_URL=(str, ""),
    WEATHER_API_KEY=(str, ""),
    WEATHER_CACHE_SECONDS=(int, 1800),
)

# Load .env if present (local dev). In Docker the env comes from env_file.
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    # jazzmin must be listed before django.contrib.admin so its templates win.
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.locations",
    "apps.accounts",
    "apps.farms",
    "apps.sensors",
    "apps.recommendations",
    "apps.diseases",
    "apps.assistant",
    "apps.alerts",
    "apps.reports",
    "apps.weather",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database (DATABASE_URL, e.g. postgres://user:pass@db:5432/name)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://smartmurima:smartmurima@db:5432/smartmurima",
    )
}
# Use the modern psycopg (v3) backend.
DATABASES["default"]["ENGINE"] = "django.db.backends.postgresql"

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# I18N / TZ
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Kigali"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static / media
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "auth": "20/min",
        "otp": "5/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SmartMurima API",
    "DESCRIPTION": "AI-driven precision agriculture platform for Bugesera District, Rwanda.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
}

# ---------------------------------------------------------------------------
# Admin theme (django-jazzmin)
# ---------------------------------------------------------------------------
JAZZMIN_SETTINGS = {
    # Branding
    "site_title": "SmartMurima Admin",
    "site_header": "SmartMurima",
    "site_brand": "SmartMurima",
    "welcome_sign": "SmartMurima Administration",
    "copyright": "SmartMurima",
    # Search bar targets the most-used models.
    "search_model": ["accounts.User", "farms.Farm"],
    # Top navigation menu links.
    "topmenu_links": [
        {"name": "API Docs", "url": "/api/docs", "new_window": True},
        {"name": "Farmer App", "url": "http://localhost:3000", "new_window": True},
    ],
    # App + model ordering in the sidebar.
    "order_with_respect_to": [
        "accounts",
        "locations",
        "farms",
        "sensors",
        "recommendations",
        "diseases",
        "alerts",
        "weather",
        "assistant",
    ],
    # FontAwesome icons per model.
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.Group": "fas fa-users",
        "accounts.User": "fas fa-user",
        "accounts.Farmer": "fas fa-tractor",
        "locations.Location": "fas fa-map-marker-alt",
        "farms.Farm": "fas fa-seedling",
        "farms.Field": "fas fa-layer-group",
        "farms.Section": "fas fa-layer-group",
        "farms.Crop": "fas fa-wheat-awn",
        "farms.SensorNode": "fas fa-microchip",
        "sensors.SensorReading": "fas fa-wave-square",
        "recommendations.Recommendation": "fas fa-lightbulb",
        "diseases.DiseaseReport": "fas fa-bug",
        "alerts.Alert": "fas fa-bell",
        "weather.WeatherRecord": "fas fa-cloud-sun",
        "assistant.KnowledgeDocument": "fas fa-book",
    },
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",
    # Open related record edits in a modal instead of a full page.
    "related_modal_active": True,
    # Hide the live UI builder in the production console.
    "show_ui_builder": False,
}

JAZZMIN_UI_TWEAKS = {
    "theme": "flatly",
    "dark_mode_theme": None,
    "navbar": "navbar-success navbar-dark",
    "navbar_small_text": False,
    "no_navbar_border": False,
    "navbar_fixed": True,
    "sidebar": "sidebar-dark-success",
    "sidebar_fixed": True,
    "sidebar_nav_small_text": False,
    "sidebar_nav_flat_style": False,
    "brand_colour": "navbar-success",
    "brand_small_text": False,
    "accent": "accent-success",
    "body_small_text": False,
    "footer_fixed": False,
    "actions_sticky_top": True,
    # Rounded, non-flat buttons for a softer, branded feel.
    "button_classes": {
        "primary": "btn-success",
        "secondary": "btn-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# OTP
# ---------------------------------------------------------------------------
OTP_TTL_SECONDS = env("OTP_TTL_SECONDS")
OTP_LENGTH = env("OTP_LENGTH")
OTP_MAX_ATTEMPTS = env("OTP_MAX_ATTEMPTS")
OTP_RESEND_COOLDOWN_SECONDS = env("OTP_RESEND_COOLDOWN_SECONDS")

# ---------------------------------------------------------------------------
# SMS gateway
# ---------------------------------------------------------------------------
SMS_PROVIDER = env("SMS_PROVIDER")
SMS_API_KEY = env("SMS_API_KEY")
SMS_SENDER_ID = env("SMS_SENDER_ID")

# ---------------------------------------------------------------------------
# MQTT
# ---------------------------------------------------------------------------
MQTT_HOST = env("MQTT_HOST")
MQTT_PORT = env("MQTT_PORT")
MQTT_TOPIC = env("MQTT_TOPIC")

# ---------------------------------------------------------------------------
# Ollama / RAG
# ---------------------------------------------------------------------------
OLLAMA_HOST = env("OLLAMA_HOST")
LLM_MODEL = env("LLM_MODEL")
EMBED_MODEL = env("EMBED_MODEL")
RAG_TOP_K = env("RAG_TOP_K")
EMBED_DIM = env("EMBED_DIM")

# ---------------------------------------------------------------------------
# Weather
# ---------------------------------------------------------------------------
WEATHER_API_URL = env("WEATHER_API_URL")
WEATHER_API_KEY = env("WEATHER_API_KEY")
WEATHER_CACHE_SECONDS = env("WEATHER_CACHE_SECONDS")

# ---------------------------------------------------------------------------
# ML artifacts
# ---------------------------------------------------------------------------
ML_ARTIFACTS_DIR = BASE_DIR / "ml" / "artifacts"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "smartmurima": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
