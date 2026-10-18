import pytest
from sqlalchemy import select
from fastapi.testclient import TestClient
from pydantic import SecretStr
from agentvora.db import Base, AgentRun, AgentEvent, AgentReport, Decision, Fill, now




def test_api(isolated):
    from agentvora.main import app

    with TestClient(app) as c:
        assert c.get("/api/health").json()["status"] == "ok"
        assert c.get("/api/portfolio").json()["cash"] == 100000
        assert c.get("/api/portfolio/positions").json() == []
        assert c.get("/api/decisions").json() == []
        assert c.get("/api/assets/BTC%2FUSD").json()["market"] == "crypto"
        assert c.get("/api/assets/invalid").status_code == 422
        assert c.post("/api/analysis/AAPL").status_code == 409
        assert (
            c.get("/api/system/status").json()["agent_network"]
            == "configuration_required"
        )
        assert c.get("/api/performance").json()["sharpe"] is None
        with c.websocket_connect("/ws") as ws:
            from agentvora.events import bus

            async def publish():
                await bus.emit("system.notice", headline="Test transport event")

            c.portal.call(publish)
            assert ws.receive_json()["headline"] == "Test transport event"
        assert c.get("/api/decisions/unknown").status_code == 404


def test_operator_authentication(isolated, monkeypatch):
    from agentvora.main import app
    from agentvora.config import settings

    monkeypatch.setattr(settings, "admin_token", SecretStr("test-operator"))
    with TestClient(app) as c:
        assert c.post("/api/analysis/AAPL").status_code == 401
        assert (
            c.post(
                "/api/analysis/AAPL", headers={"Authorization": "Bearer test-operator"}
            ).status_code
            == 409
        )
        status = c.get("/api/system/status").text
        assert "test-operator" not in status and "GROQ" not in status


def test_postgresql_schema_compiles():
    from sqlalchemy import create_mock_engine

    statements = []
    engine = create_mock_engine(
        "postgresql+psycopg://",
        lambda sql, *a, **kw: statements.append(
            str(sql.compile(dialect=engine.dialect))
        ),
    )
    Base.metadata.create_all(engine)
    assert any("CREATE TABLE fills" in s for s in statements)
    assert any("UNIQUE (decision_id)" in s for s in statements)


class FakeModel:
    def __init__(self, schema=None):
        self.schema = schema

    def invoke(self, prompt):
        from langchain_core.messages import AIMessage

        if self.schema:
            values = {
                "ResearchPlan": {
                    "recommendation": "Buy",
                    "rationale": "Trend supported by supplied evidence",
                    "strategic_actions": "Allocate ten percent",
                },
                "TraderProposal": {
                    "action": "Buy",
                    "reasoning": "Verified trend",
                    "entry_price": 100,
                    "position_sizing": "10%",
                },
                "PortfolioDecision": {
                    "rating": "Buy",
                    "executive_summary": "Buy a ten percent paper position",
                    "investment_thesis": "Verified evidence supports a modest allocation",
                },
                "NormalizedDecision": {
                    "action": "BUY",
                    "confidence": 0.8,
                    "summary": "Evidence supports a modest paper allocation",
                    "requested_allocation": 0.1,
                },
            }
            return self.schema.model_validate(values[self.schema.__name__])
        return AIMessage(
            content="Explicit report: verified price structure supports a modest paper allocation. Missing data remains unavailable."
        )

    def with_structured_output(self, schema, **kwargs):
        return FakeModel(schema)

    def get_llm(self):
        return self


async def test_full_upstream_council_and_execution(isolated, monkeypatch, candles):
    import tradingagents.llm_clients as clients
    from agentvora.agents import DESKS
    from agentvora.analytics import indicators
    from agentvora.broker import account, portfolio
    from agentvora.market import market
    from agentvora.orchestrator import Orchestrator
    from agentvora.config import settings

    monkeypatch.setattr(clients, "create_tier_client", lambda *a, **kw: FakeModel())
    monkeypatch.setattr(settings, "groq_api_key", SecretStr("test-key"))
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    snapshot = {
        "symbol": "AAPL",
        "market": "stock",
        "price": 100,
        "timestamp": now(),
        "stale": False,
        "candles": candles,
        "indicators": indicators(candles),
    }

    async def snap(*args, **kw):
        return snapshot

    async def fundamentals(*args):
        return {"source": "test fixture", "facts": {"marketCap": 1000000}}

    async def news(*args):
        return []

    async def quote(*args):
        return {"price": 100, "timestamp": now(), "stale": False}

    monkeypatch.setattr(market, "snapshot", snap)
    monkeypatch.setattr(market, "fundamentals", fundamentals)
    monkeypatch.setattr(market, "news", news)
    monkeypatch.setattr(market, "quote", quote)
    with isolated.begin() as db:
        account(db)
    orch = Orchestrator()
    run = await orch.enqueue("AAPL")
    await orch.run(run["id"])
    with isolated() as db:
        saved = db.get(AgentRun, run["id"])
        assert saved.status == "complete", saved.payload
        reports = list(db.scalars(select(AgentReport)))
        assert set(r.agent for r in reports) == set(DESKS)
        events = [r.payload for r in db.scalars(select(AgentEvent))]
        for name in DESKS:
            started = next(
                i
                for i, e in enumerate(events)
                if e.get("agent") == name and e["type"] == "agent.started"
            )
            completed = next(
                i
                for i, e in enumerate(events)
                if e.get("agent") == name and e["type"] == "agent.completed"
            )
            assert started < completed
        decision = db.scalar(select(Decision))
        assert decision.payload["action"] == "BUY"
        assert decision.payload["execution"] == "filled"
        assert db.scalar(select(Fill)) is not None
        assert portfolio(db)["cash"] < 100000
    with pytest.raises(ValueError, match="cooldown"):
        await orch.enqueue("AAPL")


@pytest.mark.skipif(
    not __import__(
        "agentvora.config", fromlist=["settings"]
    ).settings.groq_api_key.get_secret_value(),
    reason="GROQ_API_KEY absent",
)
async def test_live_agent_opt_in():
    # Explicit opt-in avoids accidental quota use in normal test runs.
    import os

    if os.getenv("AGENTVORA_LIVE_TEST") != "1":
        pytest.skip("Set AGENTVORA_LIVE_TEST=1 for a single live council run")
    from agentvora.orchestrator import orchestrator

    run = await orchestrator.enqueue("AAPL", "integration")
    await orchestrator.run(run["id"])
    from agentvora.db import Session

    with Session() as db:
        assert db.get(AgentRun, run["id"]).status == "complete"
