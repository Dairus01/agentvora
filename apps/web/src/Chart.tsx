import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  ColorType,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Snapshot, Trade } from "./types";
export default function Chart({
  snapshot,
  indicators,
  trades,
  onTrade,
}: {
  snapshot: Snapshot;
  indicators: string[];
  trades: Trade[];
  onTrade: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    const dark = document.documentElement.dataset.theme !== "light";
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: {
          type: ColorType.Solid,
          color: dark ? "#080c14" : "#f7faf9",
        },
        textColor: dark ? "#7d8996" : "#596872",
        fontFamily: "IBM Plex Mono",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: dark ? "#101721" : "#e9efed" },
        horzLines: { color: dark ? "#101721" : "#e9efed" },
      },
      rightPriceScale: { borderColor: "#25303a" },
      timeScale: { borderColor: "#25303a", timeVisible: false },
      crosshair: {
        vertLine: { labelBackgroundColor: "#173e35" },
        horzLine: { labelBackgroundColor: "#173e35" },
      },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#16c995",
      downColor: "#ed6470",
      borderVisible: false,
      wickUpColor: "#16c995",
      wickDownColor: "#ed6470",
    });
    candles.setData(
      snapshot.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })),
    );
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volume
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      snapshot.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#16765070" : "#9c3e4870",
      })),
    );
    candles
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    const colors: Record<string, string> = {
      ema9: "#e0b94f",
      ema21: "#00d69b",
      ema50: "#3da3d1",
      bollinger_upper: "#957acc",
      bollinger_lower: "#957acc",
      vwap: "#ddb972",
    };
    for (const key of indicators) {
      const series = chart.addSeries(LineSeries, {
        color: colors[key] || "#7d8996",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(
        (snapshot.indicators.series[key] || []).map((p) => ({
          ...p,
          time: p.time as UTCTimestamp,
        })),
      );
    }
    const relevant = trades
      .filter((t) => t.symbol === snapshot.symbol)
      .map((t) => {
        const timestamp = Date.parse(t.timestamp) / 1000;
        const candle = [...snapshot.candles]
          .reverse()
          .find((c) => c.time <= timestamp);
        return candle
          ? {
              time: candle.time as UTCTimestamp,
              position:
                t.action === "BUY"
                  ? ("belowBar" as const)
                  : ("aboveBar" as const),
              color: t.action === "BUY" ? "#00d69b" : "#ed6470",
              shape:
                t.action === "BUY"
                  ? ("arrowUp" as const)
                  : ("arrowDown" as const),
              text: `${t.action} · PAPER`,
              id: t.decision_id,
            }
          : null;
      })
      .filter((x) => x !== null)
      .sort((a, b) => Number(a.time) - Number(b.time));
    let last = { ...snapshot.candles[snapshot.candles.length - 1] };
    const tick = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.asset !== snapshot.symbol || !detail.price) return;
      const stamp = Date.parse(detail.market_timestamp);
      if (!Number.isFinite(stamp) || Date.now() - stamp > 120000) return;
      if (
        new Date(stamp).toISOString().slice(0, 10) !==
        new Date(last.time * 1000).toISOString().slice(0, 10)
      )
        return;
      last = {
        ...last,
        close: detail.price,
        high: Math.max(last.high, detail.price),
        low: Math.min(last.low, detail.price),
      };
      candles.update({ ...last, time: last.time as UTCTimestamp });
    };
    window.addEventListener("agentvora:tick", tick);
    createSeriesMarkers(candles, relevant);
    chart.subscribeClick((p) => {
      if (p.hoveredObjectId) onTrade(String(p.hoveredObjectId));
    });
    chart.timeScale().fitContent();
    return () => {
      window.removeEventListener("agentvora:tick", tick);
      chart.remove();
    };
  }, [snapshot, indicators, trades, onTrade, theme]);
  return (
    <div
      className="chart"
      data-testid="chart"
      ref={ref}
      aria-label={`${snapshot.symbol} daily candlestick chart`}
    />
  );
}
