import { describe, expect, it } from "vitest";
import { heikinAshi, mergeCandle } from "./live";
import type { Snapshot, DeskEvent } from "./types";
const candle = { time: 60, open: 10, high: 14, low: 8, close: 12, volume: 5 };
const snapshot = { symbol: "BTC/USD", interval: "1m", candles: [candle], indicators: { latest: {}, series: {} } } as unknown as Snapshot;
describe("live chart data", () => {
  it("replaces an active candle, rolls over and rejects other intervals and old bars", () => {
    const event = { asset: "BTC/USD", interval: "1m", candle: { ...candle, close: 13 }, price: 13, timestamp: new Date().toISOString() } as DeskEvent;
    const updated = mergeCandle(snapshot, event);
    expect(updated.candles).toHaveLength(1);
    expect(updated.candles[0].close).toBe(13);
    expect(snapshot.candles[0].close).toBe(12);
    const next = mergeCandle(updated, { ...event, candle: { ...candle, time: 120 } });
    expect(next.candles).toHaveLength(2);
    expect(mergeCandle(next, event)).toBe(next);
    expect(mergeCandle(snapshot, { ...event, interval: "15m" })).toBe(snapshot);
    expect(mergeCandle(snapshot, { ...event, asset: "AAPL" })).toBe(snapshot);
  });
  it("derives Heikin Ashi from actual OHLC without modifying source prices or volume", () => {
    const derived = heikinAshi([candle, { ...candle, time: 120, open: 12, close: 14 }]);
    expect(derived[0].open).toBe(11);
    expect(derived[0].close).toBe(11);
    expect(derived[1].open).toBe(11);
    expect(derived[1].close).toBe(12);
    expect(derived[1].volume).toBe(5);
    expect(candle.close).toBe(12);
  });
});

