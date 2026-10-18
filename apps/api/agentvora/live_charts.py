"""Interval-specific exchange history and trade-driven candle/indicator updates."""

import asyncio
import time
import math
from functools import lru_cache
from contextlib import AsyncExitStack
from datetime import datetime, timezone
import httpx
from .analytics import indicators
from .db import now
from .market import market, normalize, candles_valid

INTERVALS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}


@lru_cache(maxsize=1)
def equity_calendar():
    import exchange_calendars
    return exchange_calendars.get_calendar("XNYS")


def freshness(quote):
    try:
        age = max(
            0,
            (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(quote["timestamp"].replace("Z", "+00:00"))
            ).total_seconds(),
        )
    except (ValueError, KeyError, TypeError):
        age = float("inf")
    stale = age > 120 or bool(quote.get("stale"))
    symbol = quote.get("symbol", "")
    closed = False
    if "/" not in symbol:
        from zoneinfo import ZoneInfo

        local = datetime.now(ZoneInfo("America/New_York"))
        closed = local.weekday() >= 5 or not (
            570 <= local.hour * 60 + local.minute < 960
        )
        try:
            import pandas as pd
            closed = not equity_calendar().is_open_on_minute(pd.Timestamp.now(tz="UTC").floor("min"))
        except Exception:
            pass
    return {
        "stale": stale,
        "market_status": "closed"
        if closed
        else "stale"
        if stale
        else "streaming"
        if "stream" in quote.get("source", "")
        else "polling",
        "quote_age_seconds": round(age, 1) if age != float("inf") else None,
    }


def update_candle(rows, price, stamp, step, volume=0, anchor=0):
    """Never invent intervening candles or apply out-of-order trades."""
    bucket = int((stamp - anchor) // step * step + anchor)
    if not rows or bucket < rows[-1]["time"]:
        return None
    if bucket == rows[-1]["time"]:
        last = {
            **rows[-1],
            "close": price,
            "high": max(rows[-1]["high"], price),
            "low": min(rows[-1]["low"], price),
            "volume": rows[-1]["volume"] + volume,
        }
        rows[-1] = last
    else:
        last = {
            "time": bucket,
            "open": price,
            "high": price,
            "low": price,
            "close": price,
            "volume": volume,
        }
        rows.append(last)
        del rows[:-500]
    return last


def technicals(rows, symbol, interval):
    periods = (
        (365 * 86400 if "/" in symbol else 252 * 23400) / INTERVALS[interval]
        if interval != "1d"
        else 365
        if "/" in symbol
        else 252
    )
    result = indicators(rows, annual_periods=periods)
    latest = result["latest"]
    rsi = latest.get("rsi14") if latest.get("rsi14") is not None else 50
    trend = (
        75
        if latest["trend"] == "bullish"
        else 25
        if latest["trend"] == "bearish"
        else 50
    )
    macd = 50 + 50 * math.tanh(
        (latest.get("macd_histogram") or 0)
        / (latest.get("atr14") or rows[-1]["close"] * 0.001)
    )
    bias = max(0, min(100, round(0.4 * rsi + 0.3 * trend + 0.3 * macd)))
    latest.update(
        bullish_weight=bias,
        bearish_weight=100 - bias,
        signal_strength=abs(bias - 50) * 2,
        atr_percent=(latest.get("atr14") or 0) / rows[-1]["close"] * 100,
    )
    if interval != "1d":
        for n in (1, 5, 20):
            result["latest"][f"return_{n}bars"] = result["latest"].pop(
                f"return_{n}d", None
            )
        result["latest"].pop("return_24h", None)
        result["latest"].pop("volume_24h", None)
    return result


class LiveCharts:
    def __init__(self):
        self.fetch_limit = asyncio.Semaphore(4)
        self.cache = {}
        self.locks = {}
        self.touched = {}

    async def history(self, symbol, interval="1d"):
        symbol = normalize(symbol)
        if interval not in INTERVALS:
            raise ValueError("Unsupported candle interval")
        key = (symbol, interval)
        self.touched[key] = time.monotonic()
        for expired in sorted(self.touched, key=self.touched.get)[:-120]:
            self.cache.pop(expired, None)
            self.touched.pop(expired, None)
        market.active_assets[symbol] = time.monotonic()
        async with self.locks.setdefault(key, asyncio.Lock()):
            cached = self.cache.get(key)
            if cached and time.monotonic() - cached[0] < 25:
                return cached[1]
            try:
                async with self.fetch_limit if interval != "1d" else AsyncExitStack():
                    if interval == "1d":
                        original = await market.snapshot(symbol)
                        rows = [dict(c) for c in original["candles"]]
                        source = original["source"]
                    elif "/" in symbol:
                        async with httpx.AsyncClient(timeout=18) as client:
                            response = await client.get(
                                f"https://www.bitstamp.net/api/v2/ohlc/{symbol.replace('/', '').lower()}/",
                                params={"step": INTERVALS[interval], "limit": 300},
                            )
                            response.raise_for_status()
                            rows = [
                                {
                                    "time": int(c["timestamp"]),
                                    **{
                                        k: float(c[k])
                                        for k in (
                                            "open",
                                            "high",
                                            "low",
                                            "close",
                                            "volume",
                                        )
                                    },
                                }
                                for c in response.json()["data"]["ohlc"]
                            ]
                            source = "bitstamp"
                    else:
                        import yfinance as yf

                        def fetch():
                            raw_interval = "1h" if interval == "4h" else interval
                            df = yf.Ticker(symbol).history(
                                period="5d"
                                if interval == "1m"
                                else "3mo"
                                if interval == "4h"
                                else "1mo",
                                interval=raw_interval,
                                auto_adjust=False,
                                timeout=15,
                            )
                            return [
                                {
                                    "time": int(t.timestamp()),
                                    **{
                                        k.lower(): float(c[k])
                                        for k in (
                                            "Open",
                                            "High",
                                            "Low",
                                            "Close",
                                            "Volume",
                                        )
                                    },
                                }
                                for t, c in df.iterrows()
                            ]

                        rows = await asyncio.to_thread(fetch)
                        if interval == "4h":
                            grouped = {}
                            for c in rows:
                                from zoneinfo import ZoneInfo

                                local = datetime.fromtimestamp(
                                    c["time"], ZoneInfo("America/New_York")
                                )
                                opening = local.replace(
                                    hour=9, minute=30, second=0, microsecond=0
                                ).timestamp()
                                bucket = int(
                                    opening + (c["time"] - opening) // 14400 * 14400
                                )
                                if bucket not in grouped:
                                    grouped[bucket] = {**c, "time": bucket}
                                else:
                                    old = grouped[bucket]
                                    old.update(
                                        high=max(old["high"], c["high"]),
                                        low=min(old["low"], c["low"]),
                                        close=c["close"],
                                        volume=old["volume"] + c["volume"],
                                    )
                            rows = list(grouped.values())
                        source = "yfinance"
                rows = candles_valid(rows)[-500:]
                quote = await market.quote(symbol)
                state = freshness(quote)
                result = {
                    "symbol": symbol,
                    "market": "crypto" if "/" in symbol else "stock",
                    "interval": interval,
                    "source": source,
                    "timestamp": now(),
                    "market_timestamp": quote["timestamp"],
                    "price": quote["price"],
                    "change": quote.get("change", 0),
                    "quote_source": quote["source"],
                    "candles": rows,
                    "indicators": technicals(rows, symbol, interval),
                    **state,
                }
                self.cache[key] = (time.monotonic(), result)
                return result
            except Exception as exc:
                if cached:
                    return {**cached[1], "stale": True, "market_status": "unavailable"}
                raise RuntimeError(
                    f"{interval} candle history unavailable for {symbol}; no substituted timeframe"
                ) from exc

    def apply_tick(self, symbol, price, stamp, source, volume=0, recalculate=True):
        updates = []
        epoch = datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
        if abs(datetime.now(timezone.utc).timestamp() - epoch) > 120:
            return updates
        for key, (_, data) in list(self.cache.items()):
            if key[0] != symbol or time.monotonic() - self.touched.get(key, 0) > 90:
                continue
            # Do not combine trades from different crypto venues into one candle.
            if "/" in symbol and not source.startswith(data["source"]):
                continue
            if epoch < data.get("last_tick_epoch", 0):
                continue
            step = INTERVALS[key[1]]
            anchor = data["candles"][-1]["time"] % step if "/" not in symbol else 0
            candle = update_candle(data["candles"], price, epoch, step, volume, anchor)
            if candle is None:
                continue
            data.update(
                price=price,
                market_timestamp=stamp,
                timestamp=now(),
                stale=False,
                market_status="streaming" if "stream" in source else "polling",
                last_tick_epoch=epoch,
            )
            if not recalculate:
                continue
            data["indicators"] = technicals(data["candles"], symbol, key[1])
            updates.append(
                {
                    "asset": symbol,
                    "interval": key[1],
                    "candle": candle,
                    "price": price,
                    "market_timestamp": stamp,
                    "source": source,
                    "indicators": {
                        "latest": data["indicators"]["latest"],
                        "series": {
                            k: v[-1:] for k, v in data["indicators"]["series"].items()
                        },
                    },
                }
            )
        return updates


charts = LiveCharts()
