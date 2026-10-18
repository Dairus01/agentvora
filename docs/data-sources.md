# Market data and limitations

| Data | Primary | Fallback and behavior |
|---|---|---|
| Stock daily candles | yfinance | Yahoo public chart endpoint; then marked-stale persisted snapshot |
| Stock near-live quotes | Optional Alpaca IEX when both credentials exist | Yahoo chart metadata, then historical snapshot timestamp |
| Crypto daily candles | Bitstamp public CCXT | Coinbase public REST, then Kraken public CCXT |
| Crypto quotes | Bitstamp public trades WebSocket and ticker | Coinbase and Kraken REST; unavailable or old quotes labeled |
| US fundamentals | SEC EDGAR if a contact user agent is configured | yfinance company facts |
| Crypto fundamentals | Public price/liquidity/volatility context | Company statements never requested; supply/token metrics explicitly unavailable |
| Stock news | Yahoo Finance RSS | Empty news context if unavailable |
| Crypto news | CoinDesk RSS | Empty news context if unavailable |

No paid market key is required. Configure `SEC_EDGAR_USER_AGENT=YourApp contact@example.com` to enable direct company-facts requests. Without it, yfinance is used. Optional `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` affect market data only and do not enable any broker execution.

Snapshots normalize timestamps, OHLCV and source identity; require at least 50 valid rows; cache for 60 seconds and persist. Provider awaits are bounded. Returned stale snapshots are visibly labeled and cannot produce a fill. Quotes carry the source market time, rather than disguising a retrieval time as a current quote. US stocks outside market hours may retain the last session price: the execution gate rejects quotes older than 120 seconds. Crypto REST polling remains available during upstream stream outages. WebSocket retry uses exponential backoff; browser socket reconnect is independent.

Chart OHLCV supports 1m, 5m, 15m, 30m, 1h, 4h and 1d. Intraday crypto history uses Bitstamp OHLC; stock history uses yfinance, with 4h bars aggregated from hourly observations using the regular-session anchor. Unsupported or unavailable feeds are surfaced explicitly rather than substituting daily bars. Intraday history caches for 25 seconds; active quotes poll every eight seconds and observed streaming trades update candles between reconciliations. This is not an exchange-certified consolidated tape. Public endpoints can be delayed, rate-limited, regionally blocked or temporarily unavailable; redistribution terms should be reviewed before offering a hosted public commercial feed. Near-live updates never imply tick-complete data.

News entries include title, source, publication timestamp, URL, summary, asset relevance and freshness. Filter future timestamps and entries older than seven days, deduplicate title/URL, cap context at six items. Crypto feed relevance is broad-market, not token-specific. No paid social feed or fabricated public sentiment is used.

Analytics: SMA20/50, EMA9/21/50, SMA-seeded Wilder RSI14 and ATR14, MACD12/26 and signal9, Bollinger20/2σ, rolling return volatility, volume average/ratio, typical-price cumulative VWAP over the displayed daily history, returns over 1/5/20 days, distance from recent high/low, trend and momentum classifications. Daily crypto returns/volume provide 24-hour candle measures, not rolling exchange-ticker 24-hour windows. Volatility annualizes with 252 equity sessions or 365 crypto days. Adjusted equity histories reflect vendor corporate-action handling.

## Asset catalog

The offline catalog contains 250 stocks and 50 cryptocurrency USD pairs, 300 distinct canonical symbols. Stock membership was verified against the official [Nasdaq-listed directory](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt) and [other-listed directory](https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt); cryptocurrency pairs against [Bitstamp active markets](https://www.bitstamp.net/api/v2/markets/), retrieved 2026-10-18. Test issues, funds, warrants, preferred securities and non-crypto currency bases are excluded. See `catalog-provenance.json`. Symbols remain available offline; future delistings or exchange restrictions can make data unavailable and are reported honestly.

Asset records and the latest snapshot cache are unique by canonical symbol. Refreshes update one cache row. Analysis runs retain frozen evidence separately, so historical decisions and trades can legitimately reference the same asset without duplicating its catalog entry. The 0002 migration keeps the newest existing snapshot per symbol, backed up locally before execution.

## Landing live surfaces

Navbar prices and floating cards share deduplicated quote subscriptions. Signal bars are deterministic price-derived bullish/bearish weights, not social sentiment or calibrated probability. Indicators and signal weights recompute in Python as observed candles change. Saved research renders Markdown headings, lists and tables; typing is a visual reveal of computed market observations, not a claim of live model token output. Actual agent stages animate only for running research. No model calls are triggered by opening a page. Stocks use public quotes unless optional Alpaca credentials are configured; Groq credentials provide research, not exchange data.
