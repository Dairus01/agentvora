import asyncio, contextlib, hmac, logging, time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import numpy as np
from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
    Header,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .config import settings, ROOT
from .db import (
    Session,
    Asset,
    AgentRun,
    AgentEvent,
    AgentReport,
    Decision,
    Fill,
    PortfolioSnapshot,
    Order,
    MarketSnapshot,
    serialize,
    now,
)
from .market import market, CATALOG, normalize
from .broker import account, portfolio
from .events import bus
from .orchestrator import orchestrator
from .streaming import prices
from .scanner import scan

logging.basicConfig(level=logging.INFO)


async def mark_portfolio():
    with Session() as db:
        symbols = [p["symbol"] for p in portfolio(db)["positions"]]
    prices = {}
    for s in symbols:
        try:
            q = await market.quote(s)
            if not q["stale"]:
                prices[s] = q["price"]
        except Exception:
            pass
    async with orchestrator.broker_lock:
        with Session.begin() as db:
            from .db import Position

            for p in db.scalars(select(Position)):
                if p.symbol in prices:
                    p.payload = {
                        **p.payload,
                        "last_price": prices[p.symbol],
                        "marked_at": now(),
                    }
            db.add(PortfolioSnapshot(payload=portfolio(db, prices)))
    if symbols:
        await bus.emit(
            "portfolio.updated", headline="Portfolio marked to available prices"
        )


@asynccontextmanager
async def lifespan(app):
    if (
        settings.environment == "production"
        and not settings.admin_token.get_secret_value()
    ):
        raise RuntimeError("ADMIN_TOKEN is required in production")
    # Migrations are run by setup / container entrypoint, never implicitly generated.
    with Session.begin() as db:
        account(db)
        for item in CATALOG:
            if not db.scalar(select(Asset).where(Asset.symbol == item["symbol"])):
                db.add(
                    Asset(
                        symbol=item["symbol"],
                        market=item["market"],
                        payload={"name": item["name"]},
                    )
                )
        if not db.scalar(select(PortfolioSnapshot).limit(1)):
            db.add(PortfolioSnapshot(payload=portfolio(db)))
    await orchestrator.start()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        orchestrator.cycle,
        "interval",
        minutes=settings.autonomous_interval_minutes,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        mark_portfolio, "interval", seconds=60, max_instances=1, coalesce=True
    )
    scheduler.start()
    prices.start()
    if settings.bootstrap_analysis and settings.groq_api_key.get_secret_value():
        for item in CATALOG[:2]:
            await orchestrator.enqueue(item["symbol"], "bootstrap")
    yield
    scheduler.shutdown(wait=False)
    await prices.stop()
    await orchestrator.stop()


app = FastAPI(
    title="Agentvora",
    lifespan=lifespan,
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


def symbol_or_error(symbol):
    try:
        return normalize(symbol)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


def read_rows(model, limit=200):
    with Session() as db:
        return [
            serialize(r)
            for r in db.scalars(
                select(model).order_by(model.timestamp.desc()).limit(limit)
            )
        ]


def one(model, ident):
    with Session() as db:
        row = db.get(model, ident)
        if not row:
            raise HTTPException(404, "Record not found")
        return serialize(row)


@app.get("/api/health")
def health():
    with Session() as db:
        db.execute(select(1))
    return {"status": "ok", "execution": "PAPER"}


@app.get("/api/assets")
def assets():
    return CATALOG


@app.get("/api/watchlists")
def watchlists():
    snapshots = []
    with Session() as db:
        snapshots = [row.payload for row in db.scalars(select(MarketSnapshot))]
    return {
        "groups": scan(snapshots),
        "snapshot_count": len(snapshots),
        "as_of": max((s["timestamp"] for s in snapshots), default=None),
        "method": "deterministic market desk scan",
    }


@app.get("/api/system/status")
def status():
    return {
        "agent_network": "ready"
        if settings.groq_api_key.get_secret_value()
        else "configuration_required",
        "autonomous": settings.autonomous_enabled,
        "autonomous_status": "active"
        if settings.autonomous_enabled and settings.groq_api_key.get_secret_value()
        else "waiting_for_configuration"
        if settings.autonomous_enabled
        else "paused",
        "execution": "PAPER",
        "queue_depth": orchestrator.queue.qsize(),
        "interval_minutes": settings.autonomous_interval_minutes,
        "source_repository_url": settings.source_repository_url
        if settings.source_repository_url.startswith("https://")
        else None,
        "source_available": (ROOT / "dist/agentvora-source.zip").exists(),
        "desks": 6,
    }


@app.get("/api/assets/{symbol:path}")
def asset(symbol):
    s = symbol_or_error(symbol)
    return next(x for x in CATALOG if x["symbol"] == s)


# Symbols containing a slash are carried in the path using the path converter.
@app.get("/api/market/{symbol:path}/candles")
async def candles(symbol, interval: str = "1d"):
    try:
        normalized = symbol_or_error(symbol)
        market.active_assets[normalized] = time.monotonic()
        from .live_charts import charts, INTERVALS

        if interval not in INTERVALS:
            raise HTTPException(422, "Choose 1m, 5m, 15m, 30m, 1h, 4h or 1d")
        return await charts.history(normalized, interval)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@app.get("/api/market/{symbol:path}/quote")
async def quote(symbol):
    try:
        normalized = symbol_or_error(symbol)
        market.active_assets[normalized] = time.monotonic()
        from .live_charts import freshness

        result = await market.quote(normalized)
        return {**result, **freshness(result)}
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


limits = defaultdict(deque)


@app.post("/api/analysis/{symbol:path}", status_code=202)
async def analyze(
    symbol, request: Request, authorization: str | None = Header(default=None)
):
    token = settings.admin_token.get_secret_value()
    if token and not hmac.compare_digest(authorization or "", "Bearer " + token):
        raise HTTPException(401, "Operator authorization required")
    host = request.client.host if request.client else "unknown"
    q = limits[host]
    t = time.monotonic()
    while q and q[0] < t - 60:
        q.popleft()
    if len(q) >= 4:
        raise HTTPException(429, "Analysis rate limit reached")
    q.append(t)
    try:
        return await orchestrator.enqueue(symbol_or_error(symbol))
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    except IntegrityError:
        raise HTTPException(409, "Asset already queued")


@app.get("/api/runs")
def runs():
    return read_rows(AgentRun)


@app.get("/api/runs/{run_id}")
def run(run_id):
    value = one(AgentRun, run_id)
    with Session() as db:
        value["reports"] = [
            serialize(x)
            for x in db.scalars(
                select(AgentReport)
                .where(AgentReport.run_id == run_id)
                .order_by(AgentReport.timestamp)
            )
        ]
    return value


@app.get("/api/runs/{run_id}/events")
def run_events(run_id):
    with Session() as db:
        return [
            serialize(x)
            for x in db.scalars(
                select(AgentEvent)
                .where(AgentEvent.run_id == run_id)
                .order_by(AgentEvent.timestamp)
                .limit(1000)
            )
        ]


@app.get("/api/events")
def events():
    return read_rows(AgentEvent, 150)


@app.get("/api/decisions")
def decisions():
    return read_rows(Decision)


@app.get("/api/decisions/{decision_id}")
def decision(decision_id):
    return one(Decision, decision_id)


@app.get("/api/portfolio")
def book():
    with Session.begin() as db:
        result = portfolio(db)
        first = db.scalar(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.timestamp >= now()[:10])
            .order_by(PortfolioSnapshot.timestamp)
            .limit(1)
        )
        start = first.payload["equity"] if first else settings.paper_starting_cash
        result["today_return"] = (result["equity"] / start - 1) * 100
        return result


@app.get("/api/portfolio/positions")
def positions():
    return book()["positions"]


@app.get("/api/portfolio/history")
def history():
    return list(reversed(read_rows(PortfolioSnapshot, 1500)))


@app.get("/api/trades")
def trades():
    return read_rows(Fill, 1000)


@app.get("/api/orders")
def orders():
    return read_rows(Order, 1000)


@app.get("/api/performance")
def performance():
    with Session() as db:
        fills = [serialize(x) for x in db.scalars(select(Fill))]
        ds = [serialize(x) for x in db.scalars(select(Decision))]
        os = [serialize(x) for x in db.scalars(select(Order))]
        snaps = [
            serialize(x)
            for x in db.scalars(
                select(PortfolioSnapshot).order_by(PortfolioSnapshot.timestamp)
            )
        ]
    values = np.array([x["equity"] for x in snaps])
    closed = [x["realized_pnl"] for x in fills if x["action"] == "SELL"]
    wins = [x for x in closed if x > 0]
    losses = [x for x in closed if x < 0]
    # Daily observations only: minute-level marks do not inflate annualized Sharpe.
    daily = {x["timestamp"][:10]: x["equity"] for x in snaps}
    nav = np.array(list(daily.values()))
    returns = np.diff(nav) / nav[:-1] if len(nav) > 1 else np.array([])
    return {
        "analyses": len(ds),
        "buy": sum(x["action"] == "BUY" for x in ds),
        "sell": sum(x["action"] == "SELL" for x in ds),
        "hold": sum(x["action"] == "HOLD" for x in ds),
        "orders_approved": sum(x["status"] == "filled" for x in os),
        "orders_rejected": sum(x["status"] == "rejected" for x in os),
        "completed_trades": len(closed),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": len(wins) / len(closed) * 100 if closed else None,
        "average_winner": sum(wins) / len(wins) if wins else None,
        "average_loser": sum(losses) / len(losses) if losses else None,
        "profit_factor": sum(wins) / abs(sum(losses)) if losses else None,
        "max_drawdown": float(np.max(1 - values / np.maximum.accumulate(values)) * 100)
        if len(values)
        else 0,
        "sharpe": float(np.mean(returns) / np.std(returns) * np.sqrt(365))
        if len(returns) >= 30 and np.std(returns) > 0
        else None,
    }


@app.get("/api/source/download")
def source():
    path = ROOT / "dist/agentvora-source.zip"
    if not path.exists():
        raise HTTPException(404, "Source package has not been built")
    return FileResponse(
        path, filename="agentvora-source.zip", media_type="application/zip"
    )


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    origin = ws.headers.get("origin")
    if origin and origin not in settings.cors_origins.split(","):
        await ws.close(code=1008)
        return
    await ws.accept()
    q = bus.subscribe()

    async def sender():
        while True:
            try:
                item = await asyncio.wait_for(q.get(), 25)
                await ws.send_json(item)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "heartbeat", "timestamp": now()})

    task = asyncio.create_task(sender())
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        bus.clients.discard(q)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
