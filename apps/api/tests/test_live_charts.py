import time
from datetime import datetime, timezone, timedelta
import httpx
import pytest
from agentvora.live_charts import LiveCharts, update_candle, freshness, technicals


def test_real_trade_rollover_preserves_ohlcv_without_inventing_gaps():
    rows = [
        {"time": 120, "open": 100, "high": 102, "low": 99, "close": 101, "volume": 4}
    ]
    update_candle(rows, 105, 170, 60, 2)
    assert rows[-1] == {
        "time": 120,
        "open": 100,
        "high": 105,
        "low": 99,
        "close": 105,
        "volume": 6,
    }
    update_candle(rows, 103, 300, 60, 1)
    assert [r["time"] for r in rows] == [120, 300]
    assert rows[-1]["open"] == rows[-1]["close"] == 103
    assert update_candle(rows, 500, 100, 60) is None


def test_hourly_equity_candles_keep_the_half_hour_session_alignment():
    rows = [
        {
            "time": 13 * 3600 + 1800,
            "open": 100,
            "high": 100,
            "low": 100,
            "close": 100,
            "volume": 1,
        }
    ]
    update_candle(rows, 101, 14 * 3600 + 60, 3600, anchor=1800)
    assert len(rows) == 1
    update_candle(rows, 102, 14 * 3600 + 1800, 3600, anchor=1800)
    assert rows[-1]["time"] == 14 * 3600 + 1800


def test_old_quote_is_never_marked_live():
    quote = {
        "symbol": "BTC/USD",
        "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
        "source": "bitstamp-stream",
    }
    assert freshness(quote)["stale"]
    assert freshness(quote)["market_status"] == "stale"


async def test_requested_interval_uses_exchange_step_and_separate_cache(monkeypatch):
    from agentvora.live_charts import market

    requests = []

    def handle(request):
        step = int(request.url.params["step"])
        requests.append(step)
        end = int(time.time()) // step * step
        rows = [
            {
                "timestamp": str(end - (99 - i) * step),
                "open": "100",
                "high": "103",
                "low": "99",
                "close": str(100 + i * 0.01),
                "volume": "10",
            }
            for i in range(100)
        ]
        return httpx.Response(200, json={"data": {"ohlc": rows}})

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs),
    )

    async def quote(symbol):
        return {
            "symbol": symbol,
            "price": 101,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "bitstamp-poll",
        }

    monkeypatch.setattr(market, "quote", quote)
    service = LiveCharts()
    minute = await service.history("BTC/USD", "1m")
    fifteen = await service.history("BTC/USD", "15m")
    assert requests == [60, 900]
    assert minute["candles"][-1]["time"] - minute["candles"][-2]["time"] == 60
    assert fifteen["candles"][-1]["time"] - fifteen["candles"][-2]["time"] == 900
    assert (await service.history("BTC/USD", "1m")) is minute
    with pytest.raises(ValueError, match="Unsupported"):
        await service.history("BTC/USD", "bogus")


def test_live_trade_recomputes_indicators_and_rejects_other_venues(candles):
    service = LiveCharts()
    end = int(time.time()) // 60 * 60
    rows = [
        {**c, "time": end - (len(candles) - 1 - i) * 60} for i, c in enumerate(candles)
    ]
    data = {
        "candles": rows,
        "source": "bitstamp",
        "indicators": technicals(rows, "BTC/USD", "1m"),
    }
    service.cache[("BTC/USD", "1m")] = (time.monotonic(), data)
    service.touched[("BTC/USD", "1m")] = time.monotonic()
    stamp = datetime.now(timezone.utc).isoformat()
    assert not service.apply_tick("BTC/USD", 300, stamp, "coinbase-stream")
    updates = service.apply_tick("BTC/USD", 300, stamp, "bitstamp-stream", 2)
    assert updates[0]["candle"]["close"] == 300
    assert updates[0]["indicators"]["latest"]["ema21"] > 190
    latest = updates[0]["indicators"]["latest"]
    assert latest["bullish_weight"] + latest["bearish_weight"] == 100
    assert "return_24h" not in latest


async def test_interval_api_rejects_invalid_values_without_substitution(isolated):
    from fastapi.testclient import TestClient
    from agentvora.main import app

    with TestClient(app) as client:
        assert (
            client.get("/api/market/BTC%2FUSD/candles?interval=2seconds").status_code
            == 422
        )
