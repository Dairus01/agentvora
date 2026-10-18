"""Market desk watchlist membership from verified deterministic snapshots."""


def scan(snapshots):
    groups = [
        {
            "name": "Momentum Leaders",
            "description": "Constructive trend with confirming momentum and participation.",
            "symbols": [],
        },
        {
            "name": "AI / Compute Complex",
            "description": "Compute and platform companies with constructive market structure.",
            "symbols": [],
        },
        {
            "name": "Breakout Watch",
            "description": "Near the recent high, with above-average participation.",
            "symbols": [],
        },
    ]
    for snapshot in snapshots:
        if snapshot.get("stale"):
            continue
        m = snapshot["indicators"]["latest"]
        symbol = snapshot["symbol"]
        rsi = m.get("rsi14")
        volume = m.get("volume_ratio")
        distance = m.get("distance_high")
        if (
            m.get("trend") == "bullish"
            and rsi is not None
            and 50 <= rsi < 75
            and volume is not None
            and volume >= 0.8
        ):
            groups[0]["symbols"].append(symbol)
        if symbol in ("NVDA", "MSFT", "AMZN", "META") and m.get("trend") == "bullish":
            groups[1]["symbols"].append(symbol)
        if (
            distance is not None
            and distance >= -2
            and volume is not None
            and volume >= 1.1
        ):
            groups[2]["symbols"].append(symbol)
    return groups
