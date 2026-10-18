import type { Snapshot, DeskEvent, Candle } from "./types";
export type ChartStyle = "candles" | "heikin" | "bars" | "line" | "area";

export function mergeCandle(data: Snapshot, event: DeskEvent): Snapshot {
  if (!event.candle || event.asset !== data.symbol || event.interval !== (data.interval || "1d")) return data;
  const last = data.candles.at(-1);
  if (last && event.candle.time < last.time) return data;
  const candles = last?.time === event.candle.time ? [...data.candles.slice(0, -1), event.candle] : [...data.candles, event.candle].slice(-500);
  const series = { ...data.indicators.series };
  for (const [name, points] of Object.entries(event.indicators?.series || {})) {
    const p = points.at(-1); if (!p) continue;
    const old = series[name] || [];
    series[name] = old.at(-1)?.time === p.time ? [...old.slice(0, -1), p] : [...old, p].slice(-500);
  }
  return { ...data, candles, price: event.price ?? data.price, market_timestamp: event.market_timestamp || data.market_timestamp, timestamp: event.timestamp,
    stale: false, live_update: true, market_status: event.source?.includes("stream") ? "streaming" : "polling",
    indicators: { latest: event.indicators?.latest || data.indicators.latest, series } };
}

export function heikinAshi(rows: Candle[]): Candle[] {
  const output: Candle[] = [];
  for (const row of rows) {
    const previous = output.at(-1);
    const open = previous ? (previous.open + previous.close) / 2 : (row.open + row.close) / 2;
    const close = (row.open + row.high + row.low + row.close) / 4;
    output.push({ ...row, open, close, high: Math.max(row.high, open, close), low: Math.min(row.low, open, close) });
  }
  return output;
}
