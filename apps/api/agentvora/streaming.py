"""Real exchange trades, bounded broadcasts, and honest REST quote fallback."""

import asyncio, json, time
from datetime import datetime, timezone
import websockets
from .market import market
from .events import bus
from .live_charts import charts, freshness


class PriceStream:
    def __init__(self):
        self.tasks = []
        self.latest = {}
        self.stamps = {}

    async def publish(self, symbol, price, stamp, source, volume=0):
        epoch = datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
        if (
            not price > 0
            or abs(time.time() - epoch) > 120
            or epoch < self.stamps.get(symbol, 0)
        ):
            return
        if epoch == self.stamps.get(symbol) and volume == 0:
            return
        self.stamps[symbol] = epoch
        prior = market.quote_cache.get(symbol, (0, {}))[1]
        quote = {
            **prior,
            "symbol": symbol,
            "price": price,
            "timestamp": stamp,
            "source": source,
            "stale": False,
        }
        if prior.get("previous_close"):
            quote["change"] = (price / prior["previous_close"] - 1) * 100
        quote.update(freshness(quote))
        market.quote_cache[symbol] = (time.monotonic(), quote)
        due = time.monotonic() - self.latest.get(symbol, 0) >= 1
        updates = charts.apply_tick(
            symbol, price, stamp, source, volume, recalculate=due
        )
        if not due:
            return
        self.latest[symbol] = time.monotonic()
        await bus.emit(
            "market.tick",
            persist=False,
            asset=symbol,
            price=price,
            change=quote.get("change"),
            market_timestamp=stamp,
            source=source,
            stale=quote["stale"],
            market_status=quote["market_status"],
        )
        for update in updates:
            await bus.emit("market.candle", persist=False, **update)

    async def crypto(self):
        delay = 1
        while True:
            try:
                async with websockets.connect(
                    "wss://ws.bitstamp.net",
                    open_timeout=15,
                    ping_interval=20,
                    ping_timeout=20,
                ) as ws:
                    subscribed = set()
                    delay = 1
                    while True:
                        wanted = {
                            s.replace("/", "").lower()
                            for s, t in market.active_assets.items()
                            if "/" in s and time.monotonic() - t < 90
                        }
                        wanted.update(["btcusd", "ethusd", "solusd"])
                        for pair in wanted - subscribed:
                            await ws.send(
                                json.dumps(
                                    {
                                        "event": "bts:subscribe",
                                        "data": {"channel": "live_trades_" + pair},
                                    }
                                )
                            )
                        for pair in subscribed - wanted:
                            await ws.send(
                                json.dumps(
                                    {
                                        "event": "bts:unsubscribe",
                                        "data": {"channel": "live_trades_" + pair},
                                    }
                                )
                            )
                        subscribed = wanted
                        try:
                            raw = await asyncio.wait_for(ws.recv(), 5)
                        except asyncio.TimeoutError:
                            continue
                        message = json.loads(raw)
                        if message.get("event") == "trade":
                            data = message["data"]
                            pair = message["channel"].replace("live_trades_", "")
                            symbol = pair[:-3].upper() + "/USD"
                            stamp = datetime.fromtimestamp(
                                int(
                                    data.get(
                                        "microtimestamp",
                                        int(data["timestamp"]) * 1000000,
                                    )
                                )
                                / 1000000,
                                timezone.utc,
                            ).isoformat()
                            await self.publish(
                                symbol,
                                float(data["price"]),
                                stamp,
                                "bitstamp-stream",
                                float(data.get("amount", 0)),
                            )
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)

    async def stocks(self):
        from .config import settings

        if not (
            settings.alpaca_api_key.get_secret_value()
            and settings.alpaca_secret_key.get_secret_value()
        ):
            return
        while True:
            try:
                async with websockets.connect(
                    "wss://stream.data.alpaca.markets/v2/iex", open_timeout=15
                ) as ws:
                    await ws.send(
                        json.dumps(
                            {
                                "action": "auth",
                                "key": settings.alpaca_api_key.get_secret_value(),
                                "secret": settings.alpaca_secret_key.get_secret_value(),
                            }
                        )
                    )
                    subscribed = set()
                    while True:
                        wanted = {
                            s
                            for s, t in market.active_assets.items()
                            if "/" not in s and time.monotonic() - t < 90
                        }
                        if wanted - subscribed:
                            await ws.send(
                                json.dumps(
                                    {
                                        "action": "subscribe",
                                        "trades": list(wanted - subscribed),
                                    }
                                )
                            )
                        if subscribed - wanted:
                            await ws.send(
                                json.dumps(
                                    {
                                        "action": "unsubscribe",
                                        "trades": list(subscribed - wanted),
                                    }
                                )
                            )
                        subscribed = wanted
                        try:
                            raw = await asyncio.wait_for(ws.recv(), 5)
                        except asyncio.TimeoutError:
                            continue
                        for data in json.loads(raw):
                            if data.get("T") == "t":
                                await self.publish(
                                    data["S"],
                                    float(data["p"]),
                                    data["t"],
                                    "alpaca-iex-stream",
                                    float(data["s"]),
                                )
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(10)

    async def polling(self):
        semaphore = asyncio.Semaphore(4)

        async def poll(symbol):
            async with semaphore:
                try:
                    q = await asyncio.wait_for(market.quote(symbol), 20)
                    state = freshness(q)
                    if state["stale"]:
                        await bus.emit(
                            "market.tick",
                            persist=False,
                            asset=symbol,
                            price=q["price"],
                            market_timestamp=q["timestamp"],
                            source=q["source"],
                            **state,
                        )
                    else:
                        await self.publish(
                            symbol, q["price"], q["timestamp"], q["source"]
                        )
                except Exception:
                    await bus.emit(
                        "market.status",
                        persist=False,
                        asset=symbol,
                        market_status="unavailable",
                        stale=True,
                    )

        while True:
            symbols = [
                s for s, t in market.active_assets.items() if time.monotonic() - t < 90
            ]
            await asyncio.gather(*(poll(s) for s in symbols))
            await asyncio.sleep(8)

    def start(self):
        self.tasks = [
            asyncio.create_task(self.crypto()),
            asyncio.create_task(self.stocks()),
            asyncio.create_task(self.polling()),
        ]

    async def stop(self):
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


prices = PriceStream()
