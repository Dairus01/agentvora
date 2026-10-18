import asyncio, math, re, time, json
from pathlib import Path
from datetime import datetime, timezone
import httpx
from .analytics import indicators
from .db import Session, MarketSnapshot, NewsItem, now
from sqlalchemy import select

CATALOG = json.loads(
    Path(__file__).with_name("catalog.json").read_text(encoding="utf-8")
)
SYMBOLS = frozenset(a["symbol"] for a in CATALOG)
CRYPTO_BASES = frozenset(
    a["symbol"].split("/")[0] for a in CATALOG if a["market"] == "crypto"
)
if len(SYMBOLS) != len(CATALOG):
    raise RuntimeError("Duplicate catalog symbol")


def normalize(symbol):
    s = symbol.strip().upper()
    if s not in SYMBOLS and s in CRYPTO_BASES:
        s += "/USD"
    if s not in SYMBOLS:
        raise ValueError("Select a supported stock or cryptocurrency")
    return s


def candles_valid(rows):
    clean = []
    for r in rows:
        if (
            all(
                math.isfinite(float(r[k]))
                for k in ("time", "open", "high", "low", "close", "volume")
            )
            and r["close"] > 0
            and r["low"] > 0
            and r["high"] >= max(r["open"], r["close"], r["low"])
            and r["low"] <= min(r["open"], r["close"])
            and r["volume"] >= 0
        ):
            clean.append(r)
    if len(clean) < 50:
        raise ValueError("Insufficient valid market history")
    return sorted({r["time"]: r for r in clean}.values(), key=lambda r: r["time"])


class MarketData:
    def __init__(self):
        self.cache = {}
        self.locks = {}
        self.quote_cache = {}
        self.active_assets = {}
        self.fetch_limit = asyncio.Semaphore(4)

    async def stock_yahoo(self, symbol):
        import yfinance as yf

        def fetch():
            df = yf.Ticker(symbol).history(
                period="1y", interval="1d", auto_adjust=True, timeout=15
            )
            return [
                {
                    "time": int(i.timestamp()),
                    **{
                        k.lower(): float(row[k])
                        for k in ("Open", "High", "Low", "Close", "Volume")
                    },
                }
                for i, row in df.iterrows()
            ]

        return await asyncio.to_thread(fetch)

    async def stock_chart(self, symbol):
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                params={"range": "1y", "interval": "1d"},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            r.raise_for_status()
            data = r.json()["chart"]["result"][0]
            q = data["indicators"]["quote"][0]
        return [
            {
                "time": t,
                **{k: q[k][i] for k in ("open", "high", "low", "close", "volume")},
            }
            for i, t in enumerate(data["timestamp"])
            if all(
                q[k][i] is not None for k in ("open", "high", "low", "close", "volume")
            )
        ]

    async def crypto_exchange(self, symbol, exchange):
        import ccxt.async_support as ccxt

        ex = getattr(ccxt, exchange)({"timeout": 15000, "enableRateLimit": True})
        try:
            rows = await ex.fetch_ohlcv(symbol, "1d", limit=250)
        finally:
            await ex.close()
        return [
            {
                "time": int(t / 1000),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v,
            }
            for t, o, h, l, c, v in rows
        ]

    async def crypto_coinbase(self, symbol):
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"https://api.exchange.coinbase.com/products/{symbol.replace('/', '-')}/candles",
                params={"granularity": 86400},
            )
            r.raise_for_status()
        return [
            {"time": t, "low": l, "high": h, "open": o, "close": c, "volume": v}
            for t, l, h, o, c, v in r.json()
        ]

    async def snapshot(self, symbol, force=False):
        symbol = normalize(symbol)
        async with self.locks.setdefault(symbol, asyncio.Lock()):
            cached = self.cache.get(symbol)
            if cached and time.monotonic() - cached[0] < 60 and not force:
                return cached[1]
            providers = (
                [
                    ("bitstamp", lambda: self.crypto_exchange(symbol, "bitstamp")),
                    ("coinbase", lambda: self.crypto_coinbase(symbol)),
                    ("kraken", lambda: self.crypto_exchange(symbol, "kraken")),
                ]
                if "/" in symbol
                else [
                    ("yfinance", lambda: self.stock_yahoo(symbol)),
                    ("yahoo-chart", lambda: self.stock_chart(symbol)),
                ]
            )
            for source, fetch in providers:
                try:
                    async with self.fetch_limit:
                        rows = candles_valid(await asyncio.wait_for(fetch(), 25))
                    price = rows[-1]["close"]
                    result = {
                        "symbol": symbol,
                        "market": "crypto" if "/" in symbol else "stock",
                        "source": source,
                        "timestamp": now(),
                        "market_timestamp": datetime.fromtimestamp(
                            rows[-1]["time"], timezone.utc
                        ).isoformat(),
                        "price": price,
                        "change": (price / rows[-2]["close"] - 1) * 100,
                        "candles": rows,
                        "indicators": indicators(
                            rows, annual_periods=365 if "/" in symbol else 252
                        ),
                        "stale": False,
                        "interval": "1d",
                    }
                    self.cache[symbol] = (time.monotonic(), result)
                    with Session.begin() as db:
                        row = db.scalar(
                            select(MarketSnapshot).where(
                                MarketSnapshot.symbol == symbol
                            )
                        )
                        if row:
                            row.payload = result
                            row.timestamp = result["timestamp"]
                        else:
                            db.add(MarketSnapshot(symbol=symbol, payload=result))
                    return result
                except Exception:
                    continue
            if not cached:
                with Session() as db:
                    row = db.scalar(
                        select(MarketSnapshot)
                        .where(MarketSnapshot.symbol == symbol)
                        .order_by(MarketSnapshot.timestamp.desc())
                        .limit(1)
                    )
                    if row:
                        cached = (0, row.payload)
            if cached:
                return {**cached[1], "stale": True}
            raise RuntimeError(
                "Market data temporarily unavailable; all public sources failed"
            )

    async def quote(self, symbol):
        symbol = normalize(symbol)
        cached = self.quote_cache.get(symbol)
        if cached and time.monotonic() - cached[0] < 15:
            return cached[1]
        async with httpx.AsyncClient(timeout=15) as c:
            if "/" in symbol:
                try:
                    r = await c.get(
                        f"https://api.exchange.coinbase.com/products/{symbol.replace('/', '-')}/ticker"
                    )
                    r.raise_for_status()
                    j = r.json()
                    result = {
                        "symbol": symbol,
                        "price": float(j["price"]),
                        "timestamp": j["time"],
                        "source": "coinbase",
                        "stale": False,
                    }
                    self.quote_cache[symbol] = (time.monotonic(), result)
                    return result
                except Exception:
                    pass
                import ccxt.async_support as ccxt

                for exchange in ("bitstamp", "kraken"):
                    ex = getattr(ccxt, exchange)(
                        {"timeout": 10000, "enableRateLimit": True}
                    )
                    try:
                        tick = await asyncio.wait_for(ex.fetch_ticker(symbol), 15)
                        stamp = tick.get("timestamp")
                        if not stamp:
                            continue
                        result = {
                            "symbol": symbol,
                            "price": float(tick["last"]),
                            "timestamp": datetime.fromtimestamp(
                                stamp / 1000, timezone.utc
                            ).isoformat(),
                            "source": exchange,
                            "stale": False,
                        }
                        self.quote_cache[symbol] = (time.monotonic(), result)
                        return result
                    except Exception:
                        pass
                    finally:
                        await ex.close()
            else:
                from .config import settings

                if (
                    settings.alpaca_api_key.get_secret_value()
                    and settings.alpaca_secret_key.get_secret_value()
                ):
                    try:
                        r = await c.get(
                            f"https://data.alpaca.markets/v2/stocks/{symbol}/trades/latest",
                            params={"feed": "iex"},
                            headers={
                                "APCA-API-KEY-ID": settings.alpaca_api_key.get_secret_value(),
                                "APCA-API-SECRET-KEY": settings.alpaca_secret_key.get_secret_value(),
                            },
                        )
                        r.raise_for_status()
                        trade = r.json()["trade"]
                        result = {
                            "symbol": symbol,
                            "price": float(trade["p"]),
                            "timestamp": trade["t"],
                            "source": "alpaca-iex",
                            "stale": False,
                        }
                        self.quote_cache[symbol] = (time.monotonic(), result)
                        return result
                    except Exception:
                        pass
                try:
                    r = await c.get(
                        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                        params={"range": "1d", "interval": "1m"},
                        headers={"User-Agent": "Mozilla/5.0"},
                    )
                    r.raise_for_status()
                    m = r.json()["chart"]["result"][0]["meta"]
                    result = {
                        "symbol": symbol,
                        "price": float(m["regularMarketPrice"]),
                        "timestamp": datetime.fromtimestamp(
                            m["regularMarketTime"], timezone.utc
                        ).isoformat(),
                        "source": "yahoo-chart",
                        "stale": False,
                    }
                    self.quote_cache[symbol] = (time.monotonic(), result)
                    return result
                except Exception:
                    pass
        snap = await self.snapshot(symbol)
        return {k: snap[k] for k in ("symbol", "price", "source", "stale")} | {
            "timestamp": snap["market_timestamp"]
        }

    async def fundamentals(self, symbol):
        if "/" in symbol:
            return {
                "kind": "crypto",
                "summary": "Company statements do not apply. Evaluate public price, liquidity and volatility; token supply data unavailable.",
            }
        from .config import settings

        if settings.sec_edgar_user_agent:
            try:
                async with httpx.AsyncClient(
                    timeout=15, headers={"User-Agent": settings.sec_edgar_user_agent}
                ) as c:
                    r = await c.get("https://www.sec.gov/files/company_tickers.json")
                    r.raise_for_status()
                    entry = next(x for x in r.json().values() if x["ticker"] == symbol)
                    r = await c.get(
                        f"https://data.sec.gov/api/xbrl/companyfacts/CIK{entry['cik_str']:010d}.json"
                    )
                    r.raise_for_status()
                    facts = r.json()["facts"].get("us-gaap", {})
                    out = {}
                    for key in (
                        "Revenues",
                        "NetIncomeLoss",
                        "Assets",
                        "Liabilities",
                        "StockholdersEquity",
                    ):
                        units = facts.get(key, {}).get("units", {}).get("USD", [])
                        known = [
                            x
                            for x in units
                            if x.get("filed", "") <= now()[:10]
                            and x.get("form") in ("10-K", "10-Q")
                        ]
                        if known:
                            out[key] = sorted(
                                known,
                                key=lambda x: (x.get("end", ""), x.get("filed", "")),
                            )[-1]
                    if out:
                        return {
                            "source": "SEC EDGAR",
                            "facts": out,
                            "url": f"https://www.sec.gov/edgar/browse/?CIK={entry['cik_str']}",
                        }
            except Exception:
                pass
        try:
            import yfinance as yf

            info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
            return {
                "source": "Yahoo Finance",
                "facts": {
                    k: info.get(k)
                    for k in (
                        "marketCap",
                        "trailingPE",
                        "forwardPE",
                        "totalRevenue",
                        "profitMargins",
                        "debtToEquity",
                        "sector",
                    )
                },
            }
        except Exception:
            return {"summary": "Fundamentals unavailable"}

    async def news(self, symbol):
        import feedparser

        url = (
            "https://www.coindesk.com/arc/outboundfeeds/rss/"
            if "/" in symbol
            else f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
        )
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
                r = await c.get(url)
                r.raise_for_status()
            entries = feedparser.parse(r.text).entries
            items = []
            seen = set()
            for e in entries:
                link = e.get("link", "")
                title = e.get("title", "")
                if not link.startswith("https://") or title in seen:
                    continue
                seen.add(title)
                parsed = e.get("published_parsed")
                stamp = datetime(*parsed[:6], tzinfo=timezone.utc) if parsed else None
                if (
                    not stamp
                    or (datetime.now(timezone.utc) - stamp).total_seconds() > 7 * 86400
                    or stamp > datetime.now(timezone.utc)
                ):
                    continue
                item = {
                    "title": title,
                    "source": "CoinDesk" if "/" in symbol else "Yahoo Finance",
                    "published_at": stamp.isoformat(),
                    "url": link,
                    "summary": re.sub("<[^>]+>", "", e.get("summary", ""))[:350],
                    "asset_relevance": symbol,
                    "freshness": "recent",
                }
                items.append(item)
                if len(items) == 6:
                    break
            with Session.begin() as db:
                for item in items:
                    if not db.scalar(
                        select(NewsItem).where(NewsItem.url == item["url"])
                    ):
                        db.add(NewsItem(url=item["url"], payload=item))
            return items
        except Exception:
            return []


market = MarketData()
