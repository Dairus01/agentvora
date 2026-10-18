import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { DeskEvent, Snapshot } from "./types";
import { mergeCandle } from "./live";
export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "").replace(
  /\/$/,
  "",
);
export async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(API_ORIGIN + "/api" + url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.detail || "Service temporarily unavailable");
  }
  return r.json();
}
export async function analyze(symbol: string, token: string) {
  const r = await fetch(
    API_ORIGIN + "/api/analysis/" + encodeURIComponent(symbol),
    {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
    },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Analysis unavailable");
  return data;
}
export function useApi<T>(
  key: string,
  url: string,
  interval = 30000,
  enabled = true,
) {
  return useQuery<T>({
    enabled,
    queryKey: [key, url],
    queryFn: ({ signal }) => get<T>(url, signal),
    refetchInterval: interval,
    retry: 1,
    staleTime: 15000,
  });
}
export function mergeEvent(events: DeskEvent[], event: DeskEvent) {
  return event.type === "heartbeat" || events.some((e) => e.id === event.id)
    ? events
    : [event, ...events].slice(0, 150);
}
export function useEvents() {
  const client = useQueryClient();
  const [events, setEvents] = useState<DeskEvent[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const seed = () =>
      get<DeskEvent[]>("/events")
        .then((es) => {
          if (!stopped)
            setEvents((old) =>
              [...new Map([...old, ...es].map((e) => [e.id, e])).values()]
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 150),
            );
        })
        .catch(() => {});
    const connect = () => {
      socket = new WebSocket(
        (API_ORIGIN || location.origin).replace(/^http/, "ws") + "/ws",
      );
      socket.onopen = () => {
        setConnected(true);
        attempt = 0;
        void seed();
      };
      socket.onmessage = (e) => {
        try {
          const event: DeskEvent = JSON.parse(e.data);
          if (event.type === "heartbeat") return;
          if (event.type === "market.candle") {
            for (const [key, snapshot] of client.getQueriesData<Snapshot>({ queryKey: ["market"] })) {
              if (snapshot && snapshot.symbol === event.asset) client.setQueryData(key, mergeCandle(snapshot, event));
            }
            return;
          }
          if (event.type === "market.status") {
            client.setQueriesData({ queryKey: ["quote", "/market/" + encodeURIComponent(event.asset || "") + "/quote"] }, (old: object | undefined) => old ? { ...old, stale: true, market_status: "unavailable" } : old);
            return;
          }
          if (event.type === "market.tick") {
            client.setQueryData(
              [
                "quote",
                "/market/" + encodeURIComponent(event.asset || "") + "/quote",
              ],
              (old: object | undefined) => ({ ...old, ...event, timestamp: event.market_timestamp, symbol: event.asset }),
            );
            window.dispatchEvent(
              new CustomEvent("agentvora:tick", { detail: event }),
            );
            return;
          }
          setEvents((es) => mergeEvent(es, event));
          if (
            [
              "decision.created",
              "portfolio.updated",
              "run.completed",
              "agent.error",
            ].includes(event.type)
          )
            void client.invalidateQueries();
        } catch {
          /* ignore malformed transport payload */
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        setConnected(false);
        if (!stopped)
          timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++));
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [client]);
  return { events, connected };
}
