# Agentvora

Autonomous market intelligence and a persistent **paper** portfolio for stocks and cryptocurrency. The catalog contains **300 unique assets: 250 stocks and 50 cryptocurrencies**. Independent analysts evaluate market evidence, bullish and bearish researchers challenge one another, managers reach an explicit decision, and deterministic portfolio rules decide whether a paper order can execute.

The interface is reconstructed from the supplied application recording: near-black surfaces, emerald accents, a watchlist/chart/intelligence terminal, source-verified landing headings and restrained mono financial typography. See the reconstruction notes in `docs/video-reconstruction.md` and `docs/video-copy.md`.

## Start on Windows

Requirements: Python 3.12 (or `uv`, which can install it), Node 24 and npm. No Conda or paid data subscription required.

```powershell
cd C:\Users\Administrator\Desktop\Agentvora
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

Set `GROQ_API_KEY` in the root `.env` created by setup, then:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Open **http://localhost:3000**. API: http://127.0.0.1:8000. Server diagnostics are in `data/api.stderr.log`. Stop the development command with Ctrl+C. The setup command installs pinned dependencies, local editable packages, migrations and a sanitized downloadable source package. Re-running setup preserves `.env` and the database.

On Linux/macOS with Python 3.12 or uv: `sh scripts/setup.sh`, edit `.env`, then `sh scripts/dev.sh`.

Without a key, charts and the initialized $100,000 paper portfolio work; research displays a configuration-required state. There are no fake agent reports or invented historical returns.

## Screens

| Route | Purpose |
|---|---|
| `/` | Recording-derived landing page with actual market snapshots |
| `/terminal` | Stocks/crypto watchlist, daily candles, volume, EMA/VWAP/Bollinger toggles, indicators, paper markers and six live desks |
| `/council` | Twelve-role research graph with actual node statuses and selectable reports |
| `/portfolio` | Cash, NAV, cost basis, realized/unrealized P&L, equity curve, allocation, positions and fills |
| `/decisions` | Searchable decision archive, including HOLD and rejected orders |
| `/decisions/:id` | Analyst reports, bull/bear cases, synthesis, risk review and execution result |
| `/source` | Sanitized ZIP download, architecture and open-source attribution |

Six desks: Market, Fundamentals, News, Sentiment, Research Council, Risk & Portfolio. Expanding a desk reveals its internal roles. The risk desk includes aggressive, neutral and conservative analysts plus the Portfolio Manager. Selecting a paper marker opens the associated decision record.

## Intelligence engine

The official Tauric Research TradingAgents tree is vendored at `e8f5503e9b86d5c2710b0c76b1f686703968c9df` (retrieved 2026-10-17), without its Git history. Agentvora uses its native model client, state, routing and eight council/trading/risk factories. Four adapted analyst nodes consume bounded, precomputed market/news/fundamental snapshots. See `docs/agents.md` for the exact integration boundary.

Groq is configured server-side using native TradingAgents support. Both default tiers are `openai/gpt-oss-20b`; one debate and one risk round, four retries, 2048 output tokens, temperature 0.1. Optional `AGENTVORA_DEEP_MODEL=openai/gpt-oss-120b` changes the manager tier. Model/provider identifiers and keys do not enter the public UI. Do not add provider keys to any `VITE_` variable.

Only explicit analyst reports, conclusions, evidence and lifecycle events are published. Private reasoning tokens and raw model message lists are never streamed. Confidence is an advisory evidence-quality score, not a probability of profits.

## Market data and execution

Equities: yfinance with Yahoo chart fallback; optional Alpaca IEX **data only**. Crypto: Kraken, Coinbase and Bitstamp public sources, a reconnecting Coinbase WebSocket and REST fallback. Fundamentals: SEC EDGAR with a proper contact user agent, then yfinance. Crypto never requests company statements. News: deduplicated Yahoo/CoinDesk RSS, capped and timestamp-filtered. Public feed availability, delays and licensing limitations are documented in `docs/data-sources.md`.

Python computes all indicators. Quotes preserve market timestamps; the paper broker refuses stale/missing prices, insufficient confidence, duplicate decisions, over-allocation, insufficient reserve, daily loss-limit breaches and excess cycle trades. Default maximum position is 20%, maximum invested capital 85%, minimum cash 15%. Fees and adverse slippage are configurable. SELL closes existing long positions. There is no leverage, short selling or live-money execution mode.

The watchlist searches all 300 assets and fetches candles only for visible or selected rows. Catalog and latest-snapshot tables enforce unique symbols; refreshing a price updates its cache row. Historical decisions and fills remain separate audit records.

The SQLite/PostgreSQL ledger persists reports, runs, events, decisions, orders, fills, positions, news, usage and NAV. Alembic migrations run through setup or the container entrypoint. Back up the database before upgrades.

## Autonomy and cost

`AUTONOMOUS_ENABLED=true` schedules research every 30 minutes, with two concurrent workers and persisted per-asset cooldowns. Configure `AUTONOMOUS_ASSETS` to reduce scope. No full analysis runs on price ticks. Startup analysis is disabled; enabling `BOOTSTRAP_ANALYSIS` queues at most two assets. A cycle allows at most three paper fills. Disable scheduled research with `AUTONOMOUS_ENABLED=false`; manual analysis still works when configured.

One API process/replica is required. A sleeping backend cannot provide continuous autonomy. A failed or interrupted analysis never creates a trade from partial reports.

## Validate

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
# Browser tests, after setup:
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
cd apps/web
npx playwright install chromium
npm run e2e
```

Normal tests need no provider key: they mock external boundaries, execute all twelve council roles, verify accounting/risk/idempotency, check formatting and event replay, and exercise the UI at 1920, 1440, 1280, 1024, 768 and 390 widths. Live integration is opt-in: `AGENTVORA_LIVE_TEST=1` with a configured key, then run the live test only. It consumes one AAPL research run.

For real-data screenshot review, start the app then `node scripts/capture_screenshots.mjs`. For paired video comparison sheets, install Pillow (`python -m pip install pillow`) and run `python scripts/compare_screenshots.py`. CI runs backend/frontend/browser validation and Docker builds. See `CODEX_HANDOFF.md` for actual local results and unverified checks.

## Source package

```powershell
.venv\Scripts\python.exe scripts\build_source_package.py
```

Produces `dist/agentvora-source.zip`, served by the Source page. Includes vendor licenses and developer docs. Excludes environment secrets, runtime data, MP4, screenshots, dependencies and Git history. `SOURCE_REPOSITORY_URL` can add a real repository link; no invented URL is shipped.

## Deploy

`docker compose up --build -d` serves the frontend on 3000 and API on loopback 8000 with persistent data. Docker must be installed separately. See `docs/deployment.md` for a single-server TLS deployment and a static frontend + always-on API + PostgreSQL deployment. Remote production analysis controls require `ADMIN_TOKEN`, separate from the provider key, entered through the terminal settings button. The optional frontend `VITE_API_ORIGIN` contains only the public API URL.

## License

Apache-2.0. Agentvora integrates TradingAgents by Tauric Research and preserves its license/attribution; it does not claim authorship of that framework. Chart and font notices are retained. See `THIRD_PARTY_NOTICES.md` and `docs/licensing.md`.
