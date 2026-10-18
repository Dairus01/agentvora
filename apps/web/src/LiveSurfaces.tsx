import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Play } from "lucide-react";
import { useApi, analyze } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveMarket, useQuoteState } from "./useLiveMarket";
import { Label } from "./ui";
import { money, num, pct, date } from "./format";
import type { DeskEvent, Run, Status } from "./types";
import Report from "./Report";

export function MotionRegion({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let visible = false;
    const sync = () => { if (ref.current) ref.current.dataset.motion = visible && !document.hidden ? "on" : "off"; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  return <div {...props} ref={ref} className={className} data-motion="off">{children}</div>;
}

function TickerItem({ symbol }: { symbol: string }) {
  const { quote, price, data } = useLiveMarket(symbol, "1m");
  const state = useQuoteState(quote);
  return <Link className="ticker-item" to={"/terminal?symbol=" + encodeURIComponent(symbol)}>
    <b>{symbol.replace("/USD", "")}</b><span className="live-number" key={price}>{price == null ? "—" : num(price)}</span>
    <span className={(quote?.change ?? 0) < 0 ? "negative" : "positive"}>{pct(quote?.change ?? data?.change)}</span>
    <small>{state}</small>
  </Link>;
}
export function MarketTicker() {
  const symbols = ["BTC/USD", "ETH/USD", "AAPL", "NVDA", "SOL/USD", "MSFT", "XRP/USD", "TSLA"];
  return <MotionRegion className="ticker-strip live-ticker" aria-label="Updating market prices"><div className="ticker-track">{[0, 1].map(copy => <div className="ticker-group" key={copy} aria-hidden={copy === 1 || undefined} inert={copy === 1 || undefined}>{symbols.map(symbol => <TickerItem key={symbol} symbol={symbol} />)}</div>)}</div></MotionRegion>;
}

export function SentimentCard({ symbol }: { symbol: string }) {
  const { data, quote } = useLiveMarket(symbol);
  const state = useQuoteState(quote);
  const m = data?.indicators.latest;
  const bull = Number(m?.bullish_weight ?? 50), bear = Number(m?.bearish_weight ?? 50);
  return <article className="signal-card live-signal" data-testid={"sentiment-" + symbol}>
    <div className="card-heading"><b>{symbol.replace("/USD", "")}</b><div><Label>SIGNAL STRENGTH</Label><strong>{typeof m?.signal_strength === "number" ? num(m.signal_strength, 0) + "%" : "—"}</strong></div></div>
    <span className={bull > 55 ? "positive mono" : bull < 45 ? "negative mono" : "muted mono"}>{String(m?.trend || "CONNECTING").toUpperCase()}</span>
    <div className="bias-labels mono"><span className="positive">BULL {m ? bull : "—"}</span><span className="negative">BEAR {m ? bear : "—"}</span></div>
    <div className="bias-track" aria-label="Price-derived bullish and bearish weights"><i style={{ width: bull + "%" }} /><i style={{ width: bear + "%" }} /></div>
    <div className="signal-metrics"><div><Label>RSI · 1M</Label><b>{num(m?.rsi14 as number)}</b></div><div><Label>MOMENTUM</Label><b className={m?.momentum === "positive" ? "positive" : "negative"}>{String(m?.momentum || "—").toUpperCase()}</b></div><div><Label>ATR / PRICE</Label><b>{num(m?.atr_percent as number, 2)}%</b></div></div>
    <small className="mono muted">{state.toUpperCase()} · PRICE-DERIVED, NOT SOCIAL SENTIMENT</small>
  </article>;
}

export function LiveAnalytics({ symbol }: { symbol: string }) {
  const { data, quote } = useLiveMarket(symbol);
  const state = useQuoteState(quote);
  const fields = [["RSI (14)", "rsi14"], ["MACD", "macd_histogram"], ["EMA 21", "ema21"], ["EMA 50", "ema50"], ["VWAP", "vwap"], ["ATR (14)", "atr14"], ["MOMENTUM", "momentum"], ["VOLUME RATIO", "volume_ratio"]];
  return <div className="analytics-live"><div className="analytics-live-heading mono"><b>{symbol} · 1M</b><span>{state.toUpperCase()}</span></div><div className="mini-grid analytics-preview">{fields.map(([label, key]) => { const value = data?.indicators.latest[key]; return <div key={key}><Label>{label}</Label><b className="mono live-number" key={String(value)}>{typeof value === "number" ? num(value, 3) : value || "—"}</b></div>; })}</div><small className="mono muted">AS OF {quote?.timestamp ? date(quote.timestamp) : "CONNECTING"} · PYTHON-COMPUTED</small></div>;
}

export function LiveResearch({ symbol, events }: { symbol: string; events: DeskEvent[] }) {
  const { data, quote, price } = useLiveMarket(symbol);
  const { data: status } = useApi<Status>("status", "/system/status");
  const { data: runs = [] } = useApi<Run[]>("runs", "/runs", 10000);
  const run = runs.find(r => r.symbol === symbol);
  const working = run?.status === "running" || run?.status === "queued";
  const records = events.filter(e => e.asset === symbol && e.type === "agent.report" && e.summary).slice(0, 2);
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const m = data?.indicators.latest;
  const observation = price && m ? `${symbol} trades at ${money(price)}. RSI (14) is ${num(m.rsi14 as number, 1)}, with ${String(m.trend)} price structure and ${String(m.momentum)} MACD momentum. ATR is ${num(m.atr14 as number, 3)}; volume is ${num(m.volume_ratio as number, 2)}× its 20-bar average. These are computed market observations, not an AI recommendation.` : "Connecting to the exchange. Observations appear after real candles and prices arrive.";
  const latest = useRef(observation); latest.current = observation;
  const [typed, setTyped] = useState(observation);
  useEffect(() => { setTyped(latest.current); const timer = setInterval(() => setTyped(latest.current), 8000); return () => clearInterval(timer); }, [symbol]);
  async function start() {
    setBusy(true); setNotice("");
    try { await analyze(symbol, ""); await client.invalidateQueries({ queryKey: ["runs"] }); setNotice("Research queued. Reports appear as each analyst files them."); }
    catch (e) { setNotice((e as Error).message + " Open the terminal for operator settings."); }
    finally { setBusy(false); }
  }
  return <MotionRegion className="research-preview live-research" data-testid="landing-research">
    <div className="panel-title"><Activity size={15} /> MULTI-AGENT DESK <span className={"tag " + (working ? "positive" : "")}>{working ? "RESEARCHING" : status?.autonomous ? "STANDING BY" : "SCHEDULER PAUSED"}</span></div>
    <div className="research-stages">{["market", "fundamentals", "news", "sentiment", "research", "risk"].map(desk => { const event = events.find(e => e.asset === symbol && e.run_id === run?.id && e.desk === desk); return <span key={desk} className={working && event?.status === "analyzing" ? "research-active" : ""}>{desk}<i /></span>; })}</div>
    <div className="preview-report monitor-report"><Label><span className="dot" /> MARKET MONITOR · {symbol}</Label><small className="mono muted">COMPUTED OBSERVATION · {quote?.timestamp ? date(quote.timestamp) : "CONNECTING"}</small><Report text={typed} animate /></div>
    {records.map(event => <div className="preview-report filed-report" key={event.id}><Label>{event.agent} · FILED REPORT</Label><small className="mono muted">{date(event.timestamp)}</small><Report text={event.summary || ""} compact /></div>)}
    {!records.length && <p className="muted pad">No filed agent report for this asset yet. Start research to follow the live council.</p>}
    <div className="research-actions"><button className="button primary small" disabled={busy || working || !data || data.stale} onClick={() => void start()}><Play size={13} />{working ? "Research in progress" : busy ? "Queuing…" : "Run live research"}</button><Link to={"/terminal?symbol=" + encodeURIComponent(symbol)} className="text-link">Open terminal <ArrowRight size={13} /></Link></div>
    {notice && <p className="notice" role="status">{notice}</p>}
  </MotionRegion>;
}
