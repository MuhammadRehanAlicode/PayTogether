FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pay1/requirements.txt ./
RUN apt-get update && apt-get install -y \
    pkg-config \
    default-libmysqlclient-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
    


RUN python -m pip install --upgrade pip && python -m pip install -r requirements.txt

COPY pay1/ ./
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Railway injects PORT. Migrations run before each deployment so the linked
# PostgreSQL database always has the current schema.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
