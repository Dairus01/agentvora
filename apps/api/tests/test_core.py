from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import select, func
from agentvora.market import normalize, MarketData
from agentvora.analytics import indicators
from agentvora.broker import account, portfolio, execute
from agentvora.db import AgentRun, Decision, Fill, PortfolioSnapshot, now
from agentvora.agents import NormalizedDecision, clean_report


def decision(db, action="BUY", confidence=0.8, allocation=0.1):
    run = AgentRun(symbol="AAPL", status="complete")
    db.add(run)
    db.flush()
    d = Decision(
        run_id=run.id,
        symbol="AAPL",
        payload={
            "action": action,
            "confidence": confidence,
            "requested_allocation": allocation,
        },
    )
    db.add(d)
    db.flush()
    return d


def quote(price=100):
    return {"price": price, "timestamp": now(), "stale": False}


@pytest.mark.parametrize(
    "raw,expected",
    [
        (" aapl ", "AAPL"),
        ("btc", "BTC/USD"),
        ("eth/usd", "ETH/USD"),
        ("SOL", "SOL/USD"),
    ],
)
def test_symbol(raw, expected):
    assert normalize(raw) == expected


@pytest.mark.parametrize("raw", ["../../.env", "BTC/USDT", "AAPL;DROP", "", "USD"])
def test_reject_symbol(raw):
    with pytest.raises(ValueError):
        normalize(raw)


def test_indicators(candles):
    data = indicators(candles)
    x = data["latest"]
    assert x["sma20"] == pytest.approx(sum(range(182, 202)) / 20)
    assert x["rsi14"] == 100
    assert x["trend"] == "bullish"
    assert x["atr14"] == pytest.approx(4)
    assert x["macd"] > 0
    assert x["bollinger_upper"] > x["sma20"] > x["bollinger_lower"]
    assert len(data["series"]["ema21"]) == 100


def test_flat_rsi(candles):
    for c in candles:
        c.update(open=100, high=100, low=100, close=100)
    x = indicators(candles)["latest"]
    assert x["rsi14"] == 50


def test_wilder_rsi_reference():
    closes = [
        44.34,
        44.09,
        44.15,
        43.61,
        44.33,
        44.83,
        45.10,
        45.42,
        45.84,
        46.08,
        45.89,
        46.03,
        45.61,
        46.28,
        46.28,
    ]
    rows = [
        {
            "time": i,
            "open": c,
            "high": c + 0.1,
            "low": c - 0.1,
            "close": c,
            "volume": 100,
        }
        for i, c in enumerate(closes)
    ]
    assert indicators(rows)["latest"]["rsi14"] == pytest.approx(70.464135, abs=0.000001)


def test_buy_sell_accounting(db):
    account(db)
    d = decision(db)
    order = execute(db, d, quote())
    db.flush()
    state = portfolio(db, {"AAPL": 110})
    assert order.status == "filled"
    assert state["cash"] == pytest.approx(90000, abs=0.01)
    assert state["positions"][0]["quantity"] < 100
    assert state["unrealized_pnl"] > 900
    sell = decision(db, "SELL")
    order = execute(db, sell, quote(110))
    db.flush()
    state = portfolio(db)
    assert not state["positions"]
    assert state["realized_pnl"] > 900
    assert state["cash"] == pytest.approx(100000 + state["realized_pnl"])
    assert db.scalar(select(func.count()).select_from(Fill)) == 2


def test_idempotency(db):
    account(db)
    d = decision(db)
    first = execute(db, d, quote())
    second = execute(db, d, quote())
    assert first.id == second.id
    assert db.scalar(select(func.count()).select_from(Fill)) == 1


@pytest.mark.parametrize(
    "action,conf,allocation,stale,reason",
    [
        ("SELL", 0.9, 0.1, False, "No long"),
        ("BUY", 0.2, 0.1, False, "Confidence"),
        ("BUY", 0.9, 0.5, False, "allocation"),
        ("BUY", 0.9, 0.1, True, "Stale"),
        ("HOLD", 0.9, 0, False, "Hold"),
    ],
)
def test_risk_reject(db, action, conf, allocation, stale, reason):
    account(db)
    d = decision(db, action, conf, allocation)
    q = quote()
    q["stale"] = stale
    order = execute(db, d, q)
    assert order.status == "rejected"
    assert reason in order.payload["reason"]
    assert portfolio(db)["cash"] == 100000


def test_stale_quote(db):
    account(db)
    d = decision(db)
    q = quote()
    q["timestamp"] = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    assert execute(db, d, q).status == "rejected"


def test_position_limit(db):
    account(db)
    for _ in range(5):
        execute(db, decision(db), quote())
    state = portfolio(db)
    assert state["invested"] <= state["equity"] * 0.201
    assert state["cash"] > 79000


def test_cycle_limit(db):
    account(db)
    d = decision(db)
    assert execute(db, d, quote(), cycle_count=3).status == "rejected"


def test_daily_loss_gate(db):
    a = account(db)
    db.add(PortfolioSnapshot(payload={"equity": 100000}))
    a.cash = 90000
    db.flush()
    order = execute(db, decision(db), quote())
    assert order.status == "rejected"
    assert "Daily portfolio loss" in order.payload["reason"]


def test_invalid_decision():
    with pytest.raises(ValueError):
        NormalizedDecision(
            action="SHORT", confidence=0.8, summary="bad", requested_allocation=0.1
        )
    with pytest.raises(ValueError):
        NormalizedDecision(
            action="BUY",
            confidence=float("nan"),
            summary="bad",
            requested_allocation=0.1,
        )
    assert "secret" not in clean_report("<think>secret</think>Explicit conclusion")
    assert clean_report("<think>unfinished private material") == ""


def test_missing_quote_time_rejected(db):
    account(db)
    d = decision(db)
    assert execute(db, d, {"price": 100, "stale": False}).status == "rejected"


def test_native_model_client_configuration(monkeypatch):
    from agentvora.agents import model_config, NormalizedDecision
    from tradingagents.llm_clients import create_tier_client

    monkeypatch.setenv("GROQ_API_KEY", "unit-test-key-no-network")
    config = model_config()
    model = create_tier_client(config, "quick").get_llm()
    assert model.model_name == "openai/gpt-oss-20b"
    assert "groq.com" in str(model.openai_api_base)
    assert (
        model.with_structured_output(NormalizedDecision, method="function_calling")
        is not None
    )


def test_watchlist_membership_is_evidence_based():
    from agentvora.scanner import scan

    snap = {
        "symbol": "NVDA",
        "stale": False,
        "indicators": {
            "latest": {
                "trend": "bullish",
                "rsi14": 62,
                "volume_ratio": 1.3,
                "distance_high": -1,
            }
        },
    }
    groups = scan([snap])
    assert all("NVDA" in group["symbols"] for group in groups)
    snap["stale"] = True
    assert all(not group["symbols"] for group in scan([snap]))


def test_catalog_contains_300_distinct_assets():
    from agentvora.market import CATALOG

    assert len(CATALOG) == 300
    assert len({a["symbol"] for a in CATALOG}) == 300
    assert sum(a["market"] == "stock" for a in CATALOG) == 250
    assert sum(a["market"] == "crypto" for a in CATALOG) == 50
    assert normalize("xrp") == "XRP/USD"
    assert normalize("adbe") == "ADBE"


async def test_market_fallback(monkeypatch, candles):
    import agentvora.market as module

    class FakeSession:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def add(self, *args):
            pass

        def scalar(self, *args):
            return None

    monkeypatch.setattr(module.Session, "begin", lambda: FakeSession())
    service = MarketData()
    called = []

    async def fail(*args):
        called.append("primary")
        raise RuntimeError("outage")

    async def fallback(*args):
        called.append("fallback")
        return candles

    monkeypatch.setattr(service, "stock_yahoo", fail)
    monkeypatch.setattr(service, "stock_chart", fallback)
    result = await service.snapshot("AAPL")
    assert result["source"] == "yahoo-chart"
    assert called == ["primary", "fallback"]
    assert (await service.snapshot("AAPL")) == result
