import numpy as np
import pandas as pd


def wilder(values, period=14):
    """Wilder smoothing seeded with the first complete simple average."""
    out = pd.Series(np.nan, index=values.index, dtype=float)
    valid = values.dropna()
    if len(valid) < period:
        return out
    seed = values.index.get_loc(valid.index[period - 1])
    out.iloc[seed] = valid.iloc[:period].mean()
    for i in range(seed + 1, len(values)):
        out.iloc[i] = (out.iloc[i - 1] * (period - 1) + values.iloc[i]) / period
    return out


def indicators(candles, annual_periods=252):
    df = pd.DataFrame(candles).sort_values("time").drop_duplicates("time")
    c, h, l, v = (df[k].astype(float) for k in ("close", "high", "low", "volume"))
    out = {}
    for n in (20, 50):
        out[f"sma{n}"] = c.rolling(n).mean()
    for n in (9, 21, 50):
        out[f"ema{n}"] = c.ewm(span=n, adjust=False).mean()
    delta = c.diff()
    gain = wilder(delta.clip(lower=0))
    loss = wilder(-delta.clip(upper=0))
    out["rsi14"] = (
        (100 - 100 / (1 + gain / loss.replace(0, np.nan)))
        .where(loss != 0, 100)
        .where((gain != 0) | (loss != 0), 50)
    )
    out["macd"] = (
        c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
    )
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()
    out["macd_histogram"] = out["macd"] - out["macd_signal"]
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(
        axis=1
    )
    out["atr14"] = wilder(tr)
    out["bollinger_mid"] = c.rolling(20).mean()
    out["bollinger_upper"] = out["bollinger_mid"] + 2 * c.rolling(20).std(ddof=0)
    out["bollinger_lower"] = out["bollinger_mid"] - 2 * c.rolling(20).std(ddof=0)
    out["volatility"] = c.pct_change().rolling(20).std() * np.sqrt(annual_periods)
    out["volume_average"] = v.rolling(20).mean()
    out["volume_ratio"] = v / out["volume_average"].replace(0, np.nan)
    out["vwap"] = ((h + l + c) / 3 * v).cumsum() / v.cumsum().replace(0, np.nan)
    for n in (1, 5, 20):
        out[f"return_{n}d"] = c.pct_change(n) * 100
    out["distance_high"] = (c / h.rolling(20).max() - 1) * 100
    out["distance_low"] = (c / l.rolling(20).min() - 1) * 100
    latest = {
        k: round(float(s.iloc[-1]), 6)
        if pd.notna(s.iloc[-1]) and np.isfinite(s.iloc[-1])
        else None
        for k, s in out.items()
    }
    latest["trend"] = (
        "bullish"
        if c.iloc[-1] > out["ema21"].iloc[-1] > out["ema50"].iloc[-1]
        else "bearish"
        if c.iloc[-1] < out["ema21"].iloc[-1] < out["ema50"].iloc[-1]
        else "mixed"
    )
    latest["momentum"] = (
        "positive" if out["macd_histogram"].iloc[-1] > 0 else "negative"
    )
    latest["return_24h"] = latest["return_1d"]
    latest["volume_24h"] = float(v.iloc[-1])
    series = {
        k: [
            {"time": int(t), "value": float(x)}
            for t, x in zip(df.time, s)
            if pd.notna(x) and np.isfinite(x)
        ]
        for k, s in out.items()
        if k in ("ema9", "ema21", "ema50", "bollinger_upper", "bollinger_lower", "vwap")
    }
    return {"latest": latest, "series": series}
