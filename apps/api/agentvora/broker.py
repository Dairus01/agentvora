from decimal import Decimal as D
from datetime import datetime, timezone
import math
from sqlalchemy import select
from .db import Account, Position, Order, Fill, PortfolioSnapshot, now
from .config import settings


def dec(x):
    return D(str(x))


def account(db):
    a = db.get(Account, "paper")
    if a is None:
        a = Account(id="paper", cash=dec(settings.paper_starting_cash), realized=0)
        db.add(a)
        db.flush()
    return a


def portfolio(db, prices=None):
    a = account(db)
    prices = prices or {}
    rows = []
    invested = D(0)
    unreal = D(0)
    for p in db.scalars(select(Position).where(Position.quantity > 0)):
        price = dec(prices.get(p.symbol, p.payload.get("last_price", p.average_entry)))
        qty = dec(p.quantity)
        entry = dec(p.average_entry)
        value = qty * price
        pnl = value - qty * entry
        invested += value
        unreal += pnl
        rows.append(
            {
                "id": p.id,
                "symbol": p.symbol,
                "market": "crypto" if "/" in p.symbol else "stock",
                "quantity": float(qty),
                "average_entry": float(entry),
                "current_price": float(price),
                "market_value": float(value),
                "unrealized_pnl": float(pnl),
                "return_pct": float((price / entry - 1) * 100),
                **p.payload,
            }
        )
    equity = dec(a.cash) + invested
    return {
        "mode": "PAPER",
        "cash": float(a.cash),
        "equity": float(equity),
        "invested": float(invested),
        "realized_pnl": float(a.realized),
        "unrealized_pnl": float(unreal),
        "total_return": float((equity / dec(settings.paper_starting_cash) - 1) * 100),
        "positions": rows,
        "timestamp": now(),
    }


def execute(db, decision, quote, cycle_count=0):
    existing = db.scalar(select(Order).where(Order.decision_id == decision.id))
    if existing:
        return existing
    # Row lock serializes portfolio mutation on PostgreSQL; caller also owns a process lock.
    a = db.scalar(
        select(Account).where(Account.id == "paper").with_for_update()
    ) or account(db)
    p = db.scalar(
        select(Position).where(Position.symbol == decision.symbol).with_for_update()
    )
    data = decision.payload
    action = data["action"]
    price = quote.get("price")
    reason = None
    state = portfolio(db)
    equity = dec(state["equity"])
    if not price or not math.isfinite(price) or price <= 0:
        reason = "Missing or invalid market price"
    elif quote.get("stale"):
        reason = "Stale market data"
    else:
        try:
            age = (
                datetime.now(timezone.utc)
                - datetime.fromisoformat(quote["timestamp"].replace("Z", "+00:00"))
            ).total_seconds()
            if age > 120 or age < -30:
                reason = "Quote outside execution freshness window"
        except (KeyError, ValueError, TypeError):
            reason = "Missing or invalid quote timestamp"
    if action == "HOLD":
        reason = "Hold: no order requested"
    elif data.get("confidence", 0) < settings.autonomous_min_confidence:
        reason = "Confidence below minimum"
    elif cycle_count >= settings.max_trades_per_cycle:
        reason = "Cycle trade limit reached"
    elif action == "SELL" and (not p or p.quantity <= 0):
        reason = "No long position to reduce"
    elif action not in ("BUY", "SELL"):
        reason = "Invalid action"
    first = db.scalar(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.timestamp >= now()[:10])
        .order_by(PortfolioSnapshot.timestamp)
        .limit(1)
    )
    day_start = dec(first.payload["equity"] if first else settings.paper_starting_cash)
    if action == "BUY" and equity < day_start * (1 - dec(settings.max_daily_loss)):
        reason = "Daily portfolio loss limit reached"
    qty = D(0)
    fee = D(0)
    fill_price = dec(price or 0)
    if not reason:
        fill_price *= 1 + dec(settings.slippage_bps) / 10000 * (
            1 if action == "BUY" else -1
        )
        fee_rate = dec(settings.transaction_cost_bps) / 10000
        if action == "BUY":
            requested = data.get("requested_allocation", 0)
            if (
                not math.isfinite(requested)
                or requested <= 0
                or requested > settings.max_position_weight
            ):
                reason = "Requested position allocation outside limits"
            else:
                held = dec(p.quantity) * dec(price) if p else D(0)
                # Conservative sizing includes fees and adverse slippage in the budget.
                budget = min(
                    equity * dec(requested),
                    equity * dec(settings.max_position_weight) - held,
                    equity * dec(settings.max_invested_weight) - dec(state["invested"]),
                    dec(a.cash) - equity * dec(settings.min_cash_weight),
                )
                if budget <= 1:
                    reason = "Position, invested capital or cash reserve limit"
                else:
                    qty = (budget / (fill_price * (1 + fee_rate))).quantize(
                        D("0.00000001")
                    )
        else:
            qty = dec(p.quantity)
        fee = qty * fill_price * fee_rate
    status = "rejected" if reason else "filled"
    order = Order(
        decision_id=decision.id,
        status=status,
        payload={
            "symbol": decision.symbol,
            "action": action,
            "reason": reason,
            "quantity": float(qty),
            "price": float(fill_price),
            "mode": "PAPER",
        },
    )
    db.add(order)
    db.flush()
    if not reason:
        realized = D(0)
        if action == "BUY":
            cost = qty * fill_price + fee
            a.cash = dec(a.cash) - cost
            if not p:
                p = Position(
                    symbol=decision.symbol, quantity=0, average_entry=0, payload={}
                )
                db.add(p)
            old = dec(p.quantity)
            p.average_entry = (old * dec(p.average_entry) + cost) / (old + qty)
            p.quantity = old + qty
        else:
            proceeds = qty * fill_price - fee
            realized = proceeds - qty * dec(p.average_entry)
            a.cash = dec(a.cash) + proceeds
            a.realized = dec(a.realized) + realized
            p.quantity = 0
        p.payload = {
            "last_price": float(price),
            "confidence": data["confidence"],
            "last_reassessment": now(),
            "decision_id": decision.id,
        }
        db.add(
            Fill(
                order_id=order.id,
                payload={
                    "symbol": decision.symbol,
                    "action": action,
                    "quantity": float(qty),
                    "price": float(fill_price),
                    "fee": float(fee),
                    "realized_pnl": float(realized),
                    "decision_id": decision.id,
                    "confidence": data["confidence"],
                    "mode": "PAPER",
                },
            )
        )
    decision.payload = {
        **data,
        "approved_allocation": float(qty * fill_price / equity)
        if not reason and equity > 0
        else 0,
        "risk_flags": [reason] if reason else [],
        "execution": status,
        "execution_reason": reason,
    }
    db.flush()
    db.add(
        PortfolioSnapshot(
            payload=portfolio(db, {decision.symbol: price}) if price else portfolio(db)
        )
    )
    return order
