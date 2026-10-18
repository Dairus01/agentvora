#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
.venv/bin/python -m compileall -q apps/api/agentvora
.venv/bin/python -m pytest apps/api/tests -q
npm run typecheck --prefix apps/web
npm run test --prefix apps/web
npm run build --prefix apps/web
