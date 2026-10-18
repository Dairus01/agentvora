# Verification — 2026-10-18

| Check | Result |
|---|---|
| Backend tests | 35 passed, one live-key integration test skipped |
| Frontend unit tests | Five passed |
| Frontend TypeScript and production build | Passed |
| Playwright | 13 passed, including 300-symbol uniqueness, ADBE/XRP search and lazy loading |
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
| Docker image execution | Not verified: no Docker/Podman runtime; WSL startup returned REGDB_E_CLASSNOTREG |
| Live model call | Not run without GROQ_API_KEY; twelve-role graph tested using model-boundary mocks |

The catalog was verified against Nasdaq's official listing directories and Bitstamp's active USD spot markets. Listing status and provider availability can change. Distinct catalog entries do not imply that every public endpoint is continuously available.

Asset and latest-snapshot tables contain one row per symbol. Decisions, fills and events are historical records and can correctly reference the same asset on different runs. Each new research run stores its frozen market snapshot for audit; cache refreshes update the unique latest row.

Local backup before the snapshot migration: `data/agentvora-before-unique-snapshots-20261018.db`. It is excluded from Git and downloadable source. Tests and screenshots do not seed mock reports or financial results into the application database.
