# Deployment

## Local production-style Compose

Requires Docker Engine/Desktop with Linux containers and Compose v2. This development machine has neither Docker nor a functioning WSL installation, so image execution could not be verified here. The CI workflow includes an actual image build on Ubuntu.

```powershell
Copy-Item .env.example .env  # only if .env does not already exist
# Edit .env and set GROQ_API_KEY.
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Open `http://localhost:3000`. Backend is bound to loopback port 8000; nginx proxies `/api` and `/ws`. API migrations run before Uvicorn. `agentvora-data` persists the SQLite ledger. Never remove this volume to upgrade. `docker compose build` rebuilds a sanitized source package inside the API image.

## Strategy A: static frontend + always-on API + PostgreSQL

1. Provision an always-on Docker-compatible API service on Render paid, Railway, Fly.io or a VPS. Build from repository root using `apps/api/Dockerfile`. Set its service port to 8000 and health path to `/api/health`. Use exactly one process/replica. Do not use sleeping services for continuous autonomy.
2. Provision PostgreSQL and set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DB?sslmode=require`. Set provider and application configuration on the API service, never in the frontend project.
3. Set `ENVIRONMENT=production`, `GROQ_API_KEY`, `ADMIN_TOKEN` (a long random operator credential), `CORS_ORIGINS=https://YOUR-FRONTEND`, and `PUBLIC_SITE_URL=https://YOUR-FRONTEND`. Allow WebSocket upgrades and keep the process running. Persist `/app/data` if you want local caches/reports across redeployments; the primary ledger is in PostgreSQL.
4. Deploy `apps/web` to any static host supporting SPA rewrites. Use Node 24, `npm ci && npm run build`, publish `dist`, and rewrite unknown paths to `/index.html`. Set the **public** build variable `VITE_API_ORIGIN=https://YOUR-API`. This variable contains only the API origin, never a key. The browser derives HTTPS API and WSS event URLs from it. API proxying is optional when this variable is set.
5. Open the terminal settings button and enter the operator token to enable authorized manual analysis calls. It is held only in memory. Automated runs use the server's configured key and schedule without this browser token.
6. Verify `/api/health`, market candles for AAPL and BTC, an event socket connection, and one inexpensive analysis. Confirm a completed decision before enabling a larger autonomous watchlist.

Agent defaults: native `groq` provider, both tiers `openai/gpt-oss-20b`, one debate round, one risk round, two workers, 2048 output tokens. Start with `AUTONOMOUS_ENABLED=false` for deployment validation; set true after verifying. Leave `BOOTSTRAP_ANALYSIS=false`. Missing credentials leave the research desks in configuration-required state while market and paper portfolio views remain available.

## Strategy B: one server, Compose and reverse proxy

1. Copy the repository to a Linux server with Docker/Compose. Create `.env`, set the key and production token, and set `ENVIRONMENT=production`, `CORS_ORIGINS=https://YOUR-DOMAIN`, `PUBLIC_SITE_URL=https://YOUR-DOMAIN`. Keep SQLite for a small single-server installation or use the PostgreSQL URL above.
2. Run `docker compose up --build -d`. Put Caddy/nginx/Traefik in front of port 3000 with TLS and WebSocket support. Example Caddy site: `research.example.com { reverse_proxy localhost:3000 }`. Firewall direct public access to 3000 when the reverse proxy runs on the host; the API's 8000 binding is already loopback-only.
3. Back up the database. For SQLite, stop the API briefly or use SQLite's backup API instead of copying a live WAL database file. For PostgreSQL use your managed backup tooling or `pg_dump`.
4. Upgrade with a database backup, `git pull` or a new source copy, then `docker compose up --build -d`. Never scale API replicas without replacing the single-owner scheduler/event architecture.

## Environment reference

`.env.example` is complete. Only `GROQ_API_KEY` is needed to unlock research in local development. Optional direct SEC access needs `SEC_EDGAR_USER_AGENT`. Optional IEX data needs both Alpaca variables. `SOURCE_REPOSITORY_URL` is shown only when a real HTTPS repository URL is configured. SQLite default is relative to the repository root; setup and dev scripts set that working directory. `ADMIN_TOKEN` is mandatory in production and is separate from the provider key.

Portfolio limits: `PAPER_STARTING_CASH=100000`, `MAX_POSITION_WEIGHT=.20`, `MAX_INVESTED_WEIGHT=.85`, `MIN_CASH_WEIGHT=.15`, `AUTONOMOUS_MIN_CONFIDENCE=.65`, `MAX_DAILY_LOSS=.05`, `MAX_TRADES_PER_CYCLE=3`, `TRANSACTION_COST_BPS=5`, `SLIPPAGE_BPS=2`. There is no live broker setting or money-execution path.

## Operations

Monitor failed runs, provider data freshness, quote timestamps, disk/database growth and worker completion latency. No model error text or credentials are sent to the browser. Important events, reports and usage are persistent; ticks are transient. Long-term retention and distributed operation are not implemented. Quote failures reject execution; do not loosen freshness limits to disguise an outage or closed market.
