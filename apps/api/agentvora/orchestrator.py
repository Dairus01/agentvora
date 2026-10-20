import asyncio, logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .db import Session, AgentRun, Decision, Lease, serialize, uid
from .config import settings
from .market import market, normalize
from .agents import intelligence, clean_report, DESKS
from .events import bus
from .broker import portfolio, execute

log = logging.getLogger(__name__)


def public_failure(exc):
    if getattr(exc, "status_code", None) == 429:
        body = getattr(exc, "body", {})
        detail = body.get("error", body) if isinstance(body, dict) else {}
        daily = (
            isinstance(detail, dict)
            and "tokens per day" in str(detail.get("message", "")).lower()
        )
        return (
            "Research service daily allowance reached. Retry after the allowance replenishes. No trade was executed."
            if daily
            else "Research service capacity limit reached. Retry later. No trade was executed."
        )
    return "Analysis could not complete. Check server diagnostics and data availability. No trade was executed."


class Orchestrator:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=100)
        self.tasks = []
        self.broker_lock = asyncio.Lock()
        self.cycle_counts = {}

    async def start(self):
        # Single API process is required; recover interrupted runs, never replay an order.
        with Session.begin() as db:
            for run in db.scalars(
                select(AgentRun).where(AgentRun.status.in_(["queued", "running"]))
            ):
                run.status = "interrupted"
            db.execute(delete(Lease))
        self.tasks = [
            asyncio.create_task(self.worker())
            for _ in range(settings.autonomous_max_concurrent_runs)
        ]

    async def stop(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)

    async def enqueue(self, symbol, trigger="manual", cycle=None):
        symbol = normalize(symbol)
        if not settings.groq_api_key.get_secret_value():
            raise ValueError("Agent service requires server configuration")
        if self.queue.full():
            raise ValueError("Analysis queue is full")
        cutoff = (
            datetime.now(timezone.utc)
            - timedelta(minutes=settings.autonomous_interval_minutes)
        ).isoformat()
        with Session.begin() as db:
            if db.get(Lease, symbol):
                raise ValueError("Analysis already queued or running for this asset")
            previous = db.scalar(
                select(AgentRun)
                .where(AgentRun.symbol == symbol, AgentRun.timestamp > cutoff)
                .order_by(AgentRun.timestamp.desc())
                .limit(1)
            )
            if previous:
                raise ValueError(
                    "Asset cooldown active; next analysis available after the configured interval"
                )
            run = AgentRun(
                id=uid(),
                symbol=symbol,
                status="queued",
                payload={"trigger": trigger, "cycle": cycle, "mode": "TESTNET"},
            )
            db.add(run)
            db.flush()
            db.add(Lease(symbol=symbol, run_id=run.id))
            result = serialize(run)
        self.queue.put_nowait(run.id)
        for agent, desk in DESKS.items():
            await bus.emit(
                "agent.queued",
                run.id,
                asset=symbol,
                desk=desk,
                agent=agent,
                status="queued",
                headline=f"{agent} queued",
            )
        return result

    async def cycle(self):
        if (
            not settings.autonomous_enabled
            or not settings.groq_api_key.get_secret_value()
        ):
            return
        cycle = uid()
        self.cycle_counts[cycle] = 0
        # Rotate to avoid repeatedly analyzing the same prefix when cycle budget is small.
        for symbol in settings.autonomous_assets.split(","):
            try:
                await self.enqueue(symbol.strip(), "scheduled", cycle)
            except (ValueError, IntegrityError):
                continue
        if len(self.cycle_counts) > 200:
            self.cycle_counts = {cycle: 0}

    async def worker(self):
        while True:
            run_id = await self.queue.get()
            try:
                await self.run(run_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Analysis worker failed")
            finally:
                self.queue.task_done()

    async def run(self, run_id):
        with Session.begin() as db:
            run = db.get(AgentRun, run_id)
            run.status = "running"
            symbol = run.symbol
            cycle = run.payload.get("cycle")
        try:
            snapshot = await market.snapshot(symbol)
            if snapshot["stale"]:
                raise ValueError("Fresh market evidence unavailable")
            with Session.begin() as db:
                run = db.get(AgentRun, run_id)
                run.payload = {**run.payload, "market_snapshot": snapshot}
            fundamentals, news = await asyncio.gather(
                market.fundamentals(symbol), market.news(symbol)
            )
            with Session.begin() as db:
                book = portfolio(db)
            final, decision = await intelligence.analyze(
                run_id, symbol, snapshot, fundamentals, news, book
            )
            fields = {
                "market_view": final.get("market_report", ""),
                "fundamental_view": final.get("fundamentals_report", ""),
                "news_view": final.get("news_report", ""),
                "sentiment_view": final.get("sentiment_report", ""),
                "bull_case": final.get("investment_debate_state", {}).get(
                    "bull_history", ""
                ),
                "bear_case": final.get("investment_debate_state", {}).get(
                    "bear_history", ""
                ),
                "research_conclusion": final.get("investment_plan", ""),
                "risk_conclusion": final.get("risk_debate_state", {}).get(
                    "history", ""
                ),
                "portfolio_conclusion": final.get("final_trade_decision", ""),
            }
            if any(
                not fields[k]
                for k in (
                    "market_view",
                    "fundamental_view",
                    "news_view",
                    "sentiment_view",
                    "bull_case",
                    "bear_case",
                    "research_conclusion",
                    "risk_conclusion",
                    "portfolio_conclusion",
                )
            ):
                raise ValueError("Incomplete council output")
            decision.update({k: clean_report(v) for k, v in fields.items()})
            decision.update(
                market=snapshot["market"],
                reference_price=snapshot["price"],
                sources=[{"url": n["url"], "title": n["title"]} for n in news],
                confidence_label="Advisory evidence score",
                mode="TESTNET",
            )
            quote = await market.quote(symbol)
            async with self.broker_lock:
                with Session.begin() as db:
                    d = Decision(run_id=run_id, symbol=symbol, payload=decision)
                    db.add(d)
                    db.flush()
                    order = execute(db, d, quote, self.cycle_counts.get(cycle, 0))
                    db.get(AgentRun, run_id).status = "complete"
                    if cycle and order.status == "filled":
                        self.cycle_counts[cycle] = self.cycle_counts.get(cycle, 0) + 1
                    result = serialize(d)
                    order_result = serialize(order)
            await bus.emit(
                "decision.created",
                run_id,
                asset=symbol,
                desk="risk",
                headline=f"{decision['action']} decision recorded",
                decision_id=result["id"],
                summary=decision["summary"],
                confidence=decision["confidence"],
            )
            await bus.emit(
                "order.created",
                run_id,
                asset=symbol,
                headline="Testnet order evaluated",
                order=order_result,
            )
            if order_result["status"] == "filled":
                await bus.emit(
                    "order.filled",
                    run_id,
                    asset=symbol,
                    headline="Testnet fill recorded",
                    order=order_result,
                )
                await bus.emit(
                    "position.updated"
                    if decision["action"] == "BUY"
                    else "position.closed",
                    run_id,
                    asset=symbol,
                    headline="Testnet position updated",
                )
            await bus.emit(
                "portfolio.updated",
                run_id,
                asset=symbol,
                headline="Portfolio accounting updated",
            )
            await bus.emit(
                "run.completed",
                run_id,
                asset=symbol,
                status="complete",
                headline="Council analysis complete",
            )
        except Exception as exc:
            # Status/code identify provider failures without logging prompts or keys.
            log.warning(
                "Run %s failed (%s; status=%s; code=%s)",
                run_id,
                type(exc).__name__,
                getattr(exc, "status_code", None),
                getattr(exc, "code", None),
            )
            with Session.begin() as db:
                run = db.get(AgentRun, run_id)
                run.status = "error"
                run.payload = {
                    **run.payload,
                    "error": public_failure(exc),
                }
            await bus.emit(
                "agent.error",
                run_id,
                asset=symbol,
                status="error",
                headline="Research service capacity limit reached; no trade executed"
                if getattr(exc, "status_code", None) == 429
                else "Analysis unavailable; no trade executed",
            )
        finally:
            with Session.begin() as db:
                db.execute(delete(Lease).where(Lease.run_id == run_id))


orchestrator = Orchestrator()
