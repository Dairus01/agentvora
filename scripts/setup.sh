#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if command -v uv >/dev/null 2>&1; then
  uv venv --python 3.12 .venv
  uv pip install --python .venv/bin/python -r requirements.lock
  uv pip install --python .venv/bin/python --no-deps -e apps/api -e vendor/TradingAgents
else
  python3.12 -m venv .venv
  .venv/bin/python -m pip install -r requirements.lock
  .venv/bin/python -m pip install --no-deps -e apps/api -e vendor/TradingAgents
fi
npm ci --prefix apps/web
[ -f .env ] || cp .env.example .env
.venv/bin/python -m alembic -c apps/api/alembic.ini upgrade head
.venv/bin/python scripts/build_source_package.py
