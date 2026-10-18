# Video reconstruction

Source: the sole MP4 in the original workspace. Original remains untouched and is never served. Probe and SHA-256 baseline: `artifacts/video-metadata.json`, `artifacts/video-hash.json`. H.264 High, 1920×1080, approximately 30 fps, 236.971 seconds; AAC stereo 44.1 kHz audio. The recording includes browser chrome (approximately y=0–122) and Windows taskbar (approximately y=1011–1080). Application content occupies the middle; compare content rather than recreating the operating system.

Extraction: 474 regular JPEG samples at 2 fps, scaled to 1280×720 for inspection; three scene changes at threshold 0.18. Continuous scrolling produces few hard scene boundaries, so regular sampling is essential. Two labeled contact sheets cover the whole recording at six-second intervals. Twelve key source frames are retained locally under `artifacts/reconstruction/reference`. Additional full-resolution extracts cover the terminal and hero. No mobile behavior is present in the recording.

| Time | State and inferred action | Components, behavior and hierarchy |
|---|---|---|
| 0–3 s | Landing, scroll begins | Compact identity/navigation header, ticker strip, large left-aligned three-line headline, green/teal word treatment, four tilted price/sparkline cards to the right. Launch and secondary CTA. Three small capability boxes below hero. |
| 4–7 s | Intelligence section | Eight feature cards in four columns/two rows, icon in outlined square, heading then muted paragraph. Cards use charcoal fills and thin borders. |
| 8–12 s | Commentary section | Left heading and explanatory paragraph, four compact spec cells; right tall AI feed panel with colored role labels, ticker, type badges, explicit commentary and footer. Typewriter/cursor behavior is visible. |
| 13–17 s | Sentiment surface | Heading, introduction, horizontal set of asset cards. Confidence, bull/bear proportions, momentum and volatility. No chart or execution controls. |
| 18–20 s | Watchlists | Three category cards: momentum leaders, compute complex and breakout watch. Each has category label, description, ticker chips and rebalancing label. |
| 21–24 s | Analytics | Two-column composition: heading/body and three explanatory bullet items left, eight-cell indicator panel right. Numeric values change. Footer mentions locally computed indicators. |
| 25–28 s | Final CTA and footer | Large centered bordered panel, soft green wash, two-line headline and gradient second line. Primary launch and secondary features CTA; small capability footnote. Footer contains brand description and navigation. |
| 29–36 s | Launch terminal | Header: back, brand, selected ticker, search, theme and connection clock. Left watchlist ~20%, center chart ~50%, intelligence ~30%. Loading chart settles into candles, volume and two EMA overlays. MSFT selected. |
| 37–53 s | MSFT intelligence | Right panel switches between role status list and scrolling commentary; status badges include ANALYZING and STREAMING. Sentiment summary carries confidence. Feed cards include role, type and timestamp. |
| 54–67 s | Chart controls | User changes timeframe, visible series shape and axis scale change. Candles remain central, volume at bottom. Crosshair labels and current price lines visible. |
| 68–96 s | AAPL selected | Watchlist highlight moves; symbol, company, price and chart change. Intelligence updates for selected asset; feed scroll continues. |
| 97–106 s | NVDA selected | Same three-column structure; price panel updates without navigation. |
| 107–124 s | GOOGL selected | Multiple chart timeframes; agent cards remain in right rail. |
| 125–137 s | NFLX selected | Candles and moving averages update. Right commentary scroll and confidence summary remain visible. |
| 138–147 s | Light theme | Theme toggle changes all surfaces to pale gray/white while maintaining green and red financial semantics. TSLA then NFLX visible. |
| 148–179 s | Return to light landing | Same content and card hierarchy, scroll through hero, sentiment, watchlists, footer, then back to top. |
| 180–188 s | Dark terminal return | Dark theme restored; NFLX selected. |
| 189–201 s | JPM selected | Watchlist scrolled downward. JPM candles, same EMA/volume arrangement and intelligence sidebar. |
| 202–230 s | PLTR selected | Multiple chart changes and commentary cards. Watchlist continues vertical scrolling independently. |
| 231–237 s | GOOGL selected | Final dark terminal state, chart controls and streaming intelligence still visible. |

## Reconstruction decisions

Agentvora preserves the hero, major verified headings, section order, dark/emerald system, tilted price cards, compact mono labels, watchlist/chart/intelligence architecture and light theme. Content that claimed five agents, fabricated continuous commentary, sub-second feeds or client-side calculations was updated to match six desks, actual executed reports, public feed limits and server-side Python analytics. Source, council, portfolio and decisions extend the same system. Only stocks and cryptocurrency are selectable. Daily candles replace the recording's synthetic-looking intraday streams; current public quote timestamps remain visible.

Run `node scripts/capture_screenshots.mjs` against the local application for real-data captures. Run `python scripts/compare_screenshots.py` for content-aligned comparison sheets. Screenshots cover 1920, 1440, 1280, 1024, 768 and 390 widths. Key checkpoints map 0s→landing; 5s→intelligence; 10s→commentary; 15s→sentiment; 20s→watchlists; 25s→closing; 36s→terminal; 60s→terminal indicators; 75s→AAPL selection; 100s→NVDA; 130s→terminal role expansion; 140s→light theme.
