# Agentvora handoff

## COMPLETED

React 19/Vite terminal and landing, Python/FastAPI research services, real public market feeds, deterministic analytics, twelve-role TradingAgents council, six visible desks, persistent paper accounting, deterministic risk gate, queued autonomous research, persisted event/WebSocket stream, council graph, portfolio and decisions, sanitized source download, migrations, local scripts, Docker definitions, CI and deployment documentation.

Catalog expanded to **300 distinct symbols: 250 stocks and 50 cryptocurrencies** on 2026-10-18. Verified exchange listing sources are recorded in `docs/catalog-provenance.json`. All 300 are searchable; only visible/selected watchlist rows request candles. Autonomous analysis remains limited to the configured small list.

Database correction: migration `0002` reduces the latest-snapshot cache from 44 rows to one per symbol and enforces a unique symbol index. The local asset table contains 300 rows and 300 distinct symbols; the migrated cache contained nine rows and nine distinct symbols before new assets were requested. Refreshes update the existing row. New analysis runs freeze their market evidence separately; financial history is preserved. Pre-migration backup: `data/agentvora-before-unique-snapshots-20261018.db` (excluded from Git and source downloads).

## VIDEO RECONSTRUCTION

236.971-second 1920×1080 recording. 474 frames at 2 fps plus scene extraction. Verified copy and chronological states documented in `docs/video-copy.md` and `docs/video-reconstruction.md`; visual tokens in `docs/video-design-system.md`. Original recording preserved. Local screenshot/comparison artifacts are excluded from source distribution.

## UPSTREAM

Official TauricResearch/TradingAgents commit `e8f5503e9b86d5c2710b0c76b1f686703968c9df`, retrieved 2026-10-17. Full source and Apache license retained without nested Git history. Integration boundary documented in `docs/agents.md`.

## AI CONFIGURATION

Required environment variable: `GROQ_API_KEY` in root `.env`, server-side only.

Default quick model: `openai/gpt-oss-20b`.

Default deep model: `openai/gpt-oss-20b`.

Optional stronger manager model is disabled. No key was available for a live paid-agent test.

## MARKET DATA

yfinance/Yahoo chart for equities, optional Alpaca IEX data, Kraken/Coinbase/Bitstamp for crypto, public Coinbase stream plus REST fallback, SEC company facts with configured contact user agent, yfinance fundamental fallback, Yahoo/CoinDesk RSS. Live AAPL and BTC/USD history/indicator fetches passed. Public regional outages are handled by fallbacks; execution requires a fresh quote.

## LOCAL START

```powershell
cd C:\Users\Administrator\Desktop\Agentvora
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
# Set GROQ_API_KEY in .env
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Open `http://localhost:3000`. Stop any existing dev servers before launching another copy.

## DOCKER START

```powershell
docker compose up --build -d
docker compose ps
```

Requires Docker Desktop/Engine with Linux containers. Local Docker execution is unverified because no Docker/Podman runtime is installed and WSL returns REGDB_E_CLASSNOTREG.

## TEST STATUS

Backend: 35 tests passed, one live-key integration test skipped because no key is present. Frontend: five unit tests passed. Typecheck and production build passed. Browser validation includes the 300-symbol uniqueness/search/lazy-loading check; final results are recorded in `docs/verification.md`. Python wheel build passed and includes `catalog.json`. Source ZIP build/download passed; secrets, databases, videos and dependencies are excluded. Docker execution remains unverified for the reason below.

## DEPLOYMENT

Shortest route: an always-on Linux server, Docker Compose and TLS reverse proxy. Alternative: static frontend with `VITE_API_ORIGIN`, one always-on API container and managed PostgreSQL. Exact steps and environment variables: `docs/deployment.md`.

## KNOWN LIMITATIONS

- Live provider execution was not verified without `GROQ_API_KEY`; full graph execution is covered with model-boundary mocks.
- Docker images could not be built locally without a working container runtime. CI is configured to build them on Ubuntu.
- Public data endpoints may be delayed, blocked or rate-limited. Candles are daily; quote freshness is enforced. Closed equity markets can legitimately reject execution.
- Social sentiment and crypto supply metrics are explicitly unavailable. News fallback is an empty, declared context.
- Single API process/replica required. Distributed scheduling, long-term retention automation and a backtest UI are not implemented.

## NEXT ACTION FOR OWNER

1. Put `GROQ_API_KEY` into `.env`.
2. Run the documented setup/start commands.
3. Open `http://localhost:3000`.
4. Deploy using `docs/deployment.md`.
