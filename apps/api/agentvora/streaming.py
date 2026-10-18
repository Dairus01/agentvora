"""Public price stream, exponential reconnect and REST fallback. No agent calls."""

import asyncio, json, time
import websockets
from .market import market
from .events import bus


class PriceStream:
    def __init__(self):
        self.tasks = []
        self.latest = {}

    async def publish(self, symbol, price, stamp, source):
        last = self.latest.get(symbol, 0)
        market.quote_cache[symbol] = (
            time.monotonic(),
            {
                "symbol": symbol,
                "price": price,
                "timestamp": stamp,
                "source": source,
                "stale": False,
            },
        )
        if time.monotonic() - last < 2:
            return
        self.latest[symbol] = time.monotonic()
        await bus.emit(
            "market.tick",
            persist=False,
            asset=symbol,
            price=price,
            market="crypto" if "/" in symbol else "stock",
            market_timestamp=stamp,
            source=source,
        )

    async def crypto(self):
        delay = 1
        while True:
            try:
                async with websockets.connect(
                    "wss://ws-feed.exchange.coinbase.com",
                    open_timeout=12,
                    ping_interval=20,
                    ping_timeout=20,
                ) as ws:
                    await ws.send(
                        json.dumps(
                            {
                                "type": "subscribe",
                                "product_ids": ["BTC-USD", "ETH-USD", "SOL-USD"],
                                "channels": ["ticker"],
                            }
                        )
                    )
                    delay = 1
                    async for raw in ws:
                        data = json.loads(raw)
                        if data.get("type") == "ticker":
                            await self.publish(
                                data["product_id"].replace("-", "/"),
                                float(data["price"]),
                                data["time"],
                                "coinbase-stream",
                            )
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)

    async def polling(self):
        while True:
            # Poll only assets requested by a browser or analysis.
            symbols = [
                symbol
                for symbol, touched in market.active_assets.items()
                if time.monotonic() - touched < 90
            ]
            for symbol in symbols:
                try:
                    q = await asyncio.wait_for(market.quote(symbol), 40)
                    await bus.emit(
                        "market.tick",
                        persist=False,
                        asset=symbol,
                        price=q["price"],
                        market_timestamp=q["timestamp"],
                        stale=q["stale"],
                        source=q["source"],
                    )
                except Exception:
                    pass
            await asyncio.sleep(20)

    def start(self):
        self.tasks = [
            asyncio.create_task(self.crypto()),
            asyncio.create_task(self.polling()),
        ]

    async def stop(self):
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


prices = PriceStream()
