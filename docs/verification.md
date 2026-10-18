# Verification — 2026-10-18

| Check | Result |
|---|---|
| Backend tests | 41 passed, paid live-key integration opt-in skipped in the normal suite |
| Frontend unit tests | Five passed |
| Frontend TypeScript and production build | Passed |
| Playwright | 13 passed against the running Docker services, including 300-symbol uniqueness, ADBE/XRP search and lazy loading |
| Python lint/compile | Passed |
| Python wheel | Built; contains the offline `agentvora/catalog.json` |
| Fresh visual captures | No page errors or horizontal overflow at 1920/1440/1280/1024/768/390 widths |
| Database asset uniqueness | 300 rows, 300 distinct canonical symbols: 250 stocks and 50 crypto |
| Latest-snapshot uniqueness | Migration 0002 consolidated old repeated observations; unique index and repeated-refresh test pass |
| Existing financial records | Compared with pre-migration backup: cash remains $100,000, no orders/fills/positions removed |
| Real stock data | AAPL and ADBE returned 251 daily candles from yfinance |
| Real crypto data | BTC/USD and XRP/USD returned 250 daily candles from Bitstamp |
| Source ZIP and download | Build passes; HTTP 200 application/zip; environment secrets, database, video and dependency directories excluded |
| Original recording | SHA-256 matches the initial baseline |
| Public UI exposure scan | No provider key, provider branding or old product identity in frontend source/build |
| Dependency audit | No production frontend vulnerabilities reported |
| PowerShell setup and launch | Both executed successfully |
| Docker image execution | Both images built and both containers healthy; API health, same-origin routing and browser suite pass. WSL registration repaired with signed Microsoft WSL 3.0.3 MSI; Docker engine 29.5.2. |
| Live model call | Key authenticated; native portfolio and normalization schema calls passed, including strict schema. Full live council completion remains unverified: the final AMZN attempt hit the account daily token limit. Scheduled research is paused. |

The catalog was verified against Nasdaq's official listing directories and Bitstamp's active USD spot markets. Listing status and provider availability can change. Distinct catalog entries do not imply that every public endpoint is continuously available.

Asset and latest-snapshot tables contain one row per symbol. Decisions, fills and events are historical records and can correctly reference the same asset on different runs. Each new research run stores its frozen market snapshot for audit; cache refreshes update the unique latest row.

Local backup before the snapshot migration: `data/agentvora-before-unique-snapshots-20261018.db`. It is excluded from Git and downloadable source. Tests and screenshots do not seed mock reports or financial results into the application database.

Live-run audit: initial AAPL (provider request failure), BTC/USD (ambiguous unstructured portfolio rating), ADBE (HTTP 429), MSFT (interrupted for meter repair), NVDA and ETH/USD (request-meter size rejection) remain persisted as genuine failed/interrupted validation runs. They produced no orders or fills. No reports were manufactured to conceal failures. Native strict normalization subsequently passed; downstream context was reduced and checked against real saved risk reports (approximately 3500?5600 reserved tokens before schema overhead, below the 7000 budget). Final AMZN validation hit HTTP 429: the provider reported a 200,000-token daily limit with 197,534 already used and 3,221 requested. No more model calls were made after identifying that daily limit.

Final database audit: 300 unique assets, seven genuine validation runs, 55 saved explicit reports, zero orders and zero fills. Local history was backed up using SQLite backup and imported into the previously unused Docker volume; integrity check passed. Original recording hash still matches. The supplied key remains in ignored `.env`; source/archive checks exclude it.

Rolling 60-second token reservations now cover both tiers and parallel councils. Empty model reports fail without emitting a completion event. Daily allowance errors have a clear public message without exposing provider details. These paths are covered by the 41-test backend suite. A completed live decision/risk-gate roundtrip still requires quota and a new bounded validation run.
