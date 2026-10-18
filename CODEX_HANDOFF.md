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

Optional stronger manager model is disabled. The supplied key is configured in ignored `.env`, server-side only. Native strict-schema connectivity passed. Live validation exposed context/rate-limit issues; bounded excerpts, rolling token reservations and native JSON-schema selection have been added. Full council completion is still unverified because the account daily limit was reached. `AUTONOMOUS_ENABLED=false` intentionally preserves remaining allowance. See `docs/verification.md`.

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

Docker Desktop is installed. The missing WSL MSI registration was repaired with the signed Microsoft WSL 3.0.3 installer; engine 29.5.2 starts successfully. Application image/runtime results are recorded in `docs/verification.md`.

## TEST STATUS

Backend: 49 tests passed; opt-in paid integration is skipped in the normal suite. Frontend: five unit tests passed. Typecheck and production build passed. Browser validation includes the 300-symbol uniqueness/search/lazy-loading check; final results are recorded in `docs/verification.md`. Python wheel build passed and includes `catalog.json`. Source ZIP build/download passed; secrets, databases, videos and dependencies are excluded. Both Docker images build; API and web containers are healthy, and all 13 browser checks pass against Docker.

## DEPLOYMENT

Shortest route: an always-on Linux server, Docker Compose and TLS reverse proxy. Alternative: static frontend with `VITE_API_ORIGIN`, one always-on API container and managed PostgreSQL. Exact steps and environment variables: `docs/deployment.md`.

## KNOWN LIMITATIONS

- Model service availability and quota depend on the account. The verified account limit is 8000 tokens/minute; application pacing defaults to 7000. Failed validation runs remain visible and never generated fills. The provider reported 197,534 / 200,000 daily tokens used; no further model calls were made after identifying that limit.
- Docker Desktop and WSL now run locally. CI also builds images on Ubuntu.
- Public data endpoints may be delayed, blocked or rate-limited. Candles are daily; quote freshness is enforced. Closed equity markets can legitimately reject execution.
- Social sentiment and crypto supply metrics are explicitly unavailable. News fallback is an empty, declared context.
- Single API process/replica required. Distributed scheduling, long-term retention automation and a backtest UI are not implemented.

## NEXT ACTION FOR OWNER

1. The supplied key is already in ignored `.env`; keep it server-side.
2. Run the documented setup/start commands.
3. Open `http://localhost:3000`.
4. Deploy using `docs/deployment.md`.

## ACTIVE LOCAL RUNTIME

Docker Compose serves http://localhost:3000 with the supplied server-side key. The active database is in `agentvora_agentvora-data`; existing local history was imported with an integrity check. `data/agentvora.db` remains a separate backup/source for local development, not a live mirror of later Docker writes. Seven validation runs and 55 genuine reports are retained. Research scheduling is paused because of the account daily allowance. After sufficient allowance replenishes, choose a schedule/asset count within that allowance before enabling it. The default six-asset, 30-minute schedule needs substantially more than a 200,000-token daily allowance.

Credential update: the owner supplied a replacement primary and separate backup key on 2026-10-18. Both authenticated via the non-generative model-list endpoint. Both are stored only in ignored `.env`; automatic server-side failover is implemented. Scheduling remains paused, and no new council run was started for this credential update. Prior quota measurements refer to the earlier credential/account state.


## Latest UI and intraday work (2026-10-18)

Replaced the former chart library with an original responsive SVG renderer, removing visible TradingView branding/credit. Seven real intervals (1m/5m/15m/30m/1h/4h/1d); five styles; keyboard/pointer zoom and pan; crosshair, volume, Python overlays and paper trade links. Added Bitstamp history/trade-driven updates and optional Alpaca IEX subscriptions. Public stocks retain delayed/closed/stale labeling. Live landing ticker, interactive floating cards, computed price-bias/indicator surfaces and actual research state feed; Markdown report rendering throughout. Opening pages makes no model requests. Research scheduler is still paused. Credentials are unchanged and stay server-side in ignored .env.

The active database remains the Docker named volume. Do not replace it with the host backup. See docs/verification.md for actual market-data evidence. User .vscode directory is untracked and untouched.


Loading correction: watchlist rows now request quotes only, avoiding daily-history contention. Intraday charts have a separate four-request semaphore. Candle endpoints time out after 25 seconds and quote endpoints after 18 seconds with explicit HTTP 504 errors; browser fetches are cancellable and bounded to 30 seconds. Loading/error/history-loaded states replace ambiguous connecting labels.
