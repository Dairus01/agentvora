from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import (
    create_engine,
    String,
    JSON,
    ForeignKey,
    Numeric,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import settings, ROOT


def now():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    timestamp: Mapped[str] = mapped_column(String(40), default=now, index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class Asset(Record, Base):
    __tablename__ = "assets"
    symbol: Mapped[str] = mapped_column(String(20), unique=True)
    market: Mapped[str] = mapped_column(String(10))


class MarketSnapshot(Record, Base):
    __tablename__ = "market_snapshots"
    symbol: Mapped[str] = mapped_column(String(20), unique=True, index=True)


class AgentRun(Record, Base):
    __tablename__ = "agent_runs"
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")


class AgentEvent(Record, Base):
    __tablename__ = "agent_events"
    run_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_runs.id"), nullable=True, index=True
    )


class AgentReport(Record, Base):
    __tablename__ = "agent_reports"
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True)
    agent: Mapped[str] = mapped_column(String(60))


class Decision(Record, Base):
    __tablename__ = "decisions"
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), unique=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)


class Order(Record, Base):
    __tablename__ = "orders"
    decision_id: Mapped[str] = mapped_column(ForeignKey("decisions.id"), unique=True)
    status: Mapped[str] = mapped_column(String(20))


class Fill(Record, Base):
    __tablename__ = "fills"
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), unique=True)


class Position(Record, Base):
    __tablename__ = "positions"
    symbol: Mapped[str] = mapped_column(String(20), unique=True)
    quantity: Mapped[float] = mapped_column(Numeric(28, 10), default=0)
    average_entry: Mapped[float] = mapped_column(Numeric(28, 10), default=0)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    cash: Mapped[float] = mapped_column(Numeric(28, 10))
    realized: Mapped[float] = mapped_column(Numeric(28, 10), default=0)


class PortfolioSnapshot(Record, Base):
    __tablename__ = "portfolio_snapshots"


class NewsItem(Record, Base):
    __tablename__ = "news_items"
    url: Mapped[str] = mapped_column(String(1000), unique=True)


class PerformanceMetric(Record, Base):
    __tablename__ = "performance_metrics"


class Usage(Record, Base):
    __tablename__ = "usage"
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True)


class Lease(Base):
    __tablename__ = "leases"
    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"))


def make_engine(url):
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("sqlite"):
        (ROOT / "data").mkdir(exist_ok=True)
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30}
        if url.startswith("sqlite")
        else {},
        pool_pre_ping=True,
    )
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def pragmas(dbapi, _):
            dbapi.execute("PRAGMA foreign_keys=ON")
            dbapi.execute("PRAGMA journal_mode=WAL")

    return engine


engine = make_engine(settings.database_url)
Session = sessionmaker(engine, expire_on_commit=False)


def serialize(row):
    return {
        "id": row.id,
        "timestamp": row.timestamp,
        **{
            c.name: getattr(row, c.name)
            for c in row.__table__.columns
            if c.name not in ("id", "timestamp", "payload")
        },
        **row.payload,
    }
