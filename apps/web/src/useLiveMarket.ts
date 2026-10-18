import { useEffect, useState } from "react";
import { useApi } from "./api";
import type { Snapshot } from "./types";
export type Quote = { price: number; change?: number; timestamp: string; source: string; stale?: boolean; market_status?: string };
export function useLiveMarket(symbol: string, interval = "1m", enabled = true) {
  const history = useApi<Snapshot>("market", "/market/" + encodeURIComponent(symbol) + "/candles?interval=" + interval, 20000, enabled);
  const quote = useApi<Quote>("quote", "/market/" + encodeURIComponent(symbol) + "/quote", 8000, enabled);
  return { ...history, quote: quote.data, price: quote.data?.price ?? history.data?.price };
}
export function useQuoteState(quote?: Quote) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!quote) return "connecting";
  if (quote.market_status === "closed") return "market closed";
  if (quote.market_status === "unavailable") return "unavailable";
  if (quote.stale || now - Date.parse(quote.timestamp) > 120000) return "stale";
  return quote.source?.includes("stream") ? "live trades" : "public feed";
}
