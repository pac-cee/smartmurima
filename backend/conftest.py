"""Global pytest configuration.

Test settings (``config.settings.test``, selected in pytest.ini) use sqlite and
stub out external services (PostgreSQL/Ollama/MQTT/ML artifacts), so the suite
runs with no infrastructure.
"""
import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DJANGO_DEBUG", "True")
