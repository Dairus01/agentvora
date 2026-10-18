import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from agentvora.db import Base


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def candles():
    return [
        {
            "time": 1700000000 + i * 86400,
            "open": 100 + i,
            "high": 103 + i,
            "low": 99 + i,
            "close": 102 + i,
            "volume": 1000 + i * 10,
        }
        for i in range(100)
    ]


from pydantic import SecretStr

@pytest.fixture
def isolated(monkeypatch, tmp_path):
    engine = create_engine(
        "sqlite:///" + str(tmp_path / "integration.db"),
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    import agentvora.db as db
    import agentvora.agents as agents
    import agentvora.events as events
    import agentvora.market as market
    import agentvora.main as main
    import agentvora.orchestrator as orch

    for module in (db, agents, events, market, main, orch):
        monkeypatch.setattr(module, "Session", factory)
    from agentvora.config import settings

    monkeypatch.setattr(settings, "autonomous_enabled", False)
    monkeypatch.setattr(settings, "bootstrap_analysis", False)
    monkeypatch.setattr(settings, "groq_api_key", SecretStr(""))
    monkeypatch.setattr(main.prices, "start", lambda: None)
    yield factory
    engine.dispose()

