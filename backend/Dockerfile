FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Run as an unprivileged user.
RUN useradd --system --no-create-home crave
USER crave

# The Dokploy domain/Traefik route must point at this container port (default 8000).
EXPOSE 8000

# Probe the app from inside the container (slim has no curl). Host 127.0.0.1 is always
# allowed by TrustedHostMiddleware.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8000'), timeout=4)"]

# Bind to all interfaces so Traefik can reach the container.
# --proxy-headers: the container is only reachable through the reverse proxy (Traefik),
# so its X-Forwarded-* headers are trusted.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
