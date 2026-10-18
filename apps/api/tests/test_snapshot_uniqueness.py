import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from agentvora.db import MarketSnapshot
from agentvora.market import MarketData


async def test_refresh_updates_one_row(isolated, monkeypatch, candles):
    service = MarketData()

    async def fetch(*args):
        return candles

    monkeypatch.setattr(service, "stock_yahoo", fetch)
    await service.snapshot("AAPL")
    await service.snapshot("aapl", force=True)
    with isolated() as db:
        assert db.scalar(select(func.count()).select_from(MarketSnapshot)) == 1
        row = db.scalar(select(MarketSnapshot))
        assert row.symbol == "AAPL"
        db.add(MarketSnapshot(symbol="AAPL", payload={}))
        with pytest.raises(IntegrityError):
            db.commit()
