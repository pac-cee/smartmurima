FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

# All Python deps ship prebuilt arm64/x86_64 wheels (psycopg[binary], numpy,
# scikit-learn, xgboost, Pillow), so no compiler/-dev headers are needed.
# Only curl is kept, for container healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Admin theme + WhiteNoise (serves collected static under gunicorn, so admin
# CSS/JS load with DEBUG off). Own layer to keep the heavy requirements layer
# above cached (avoids re-downloading numpy/xgboost wheels on a rebuild).
RUN pip install --no-cache-dir django-jazzmin==3.0.1 whitenoise==6.7.0

COPY . .

RUN mkdir -p /app/media /app/staticfiles /app/ml/artifacts

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
