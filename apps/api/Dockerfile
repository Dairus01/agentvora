FROM python:3.12-slim
WORKDIR /app
ENV AGENTVORA_ROOT=/app
COPY requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock
COPY vendor/TradingAgents vendor/TradingAgents
COPY apps/api apps/api
RUN pip install --no-cache-dir --no-deps ./vendor/TradingAgents ./apps/api
COPY scripts scripts
COPY docs docs
COPY .github .github
COPY apps/web apps/web
COPY README.md LICENSE THIRD_PARTY_NOTICES.md CODEX_HANDOFF.md .env.example .gitignore .dockerignore docker-compose.yml ./
RUN mkdir -p data && python scripts/build_source_package.py && useradd --create-home agentvora && chown -R agentvora:agentvora /app
USER agentvora
EXPOSE 8000
HEALTHCHECK --interval=30s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["sh","-c","python -m alembic -c apps/api/alembic.ini upgrade head && exec python -m uvicorn agentvora.main:app --host 0.0.0.0 --port 8000 --workers 1"]
