import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useApi, analyze } from "./api";
import type {
  Asset,
  Snapshot,
  DeskEvent,
  Status,
  Trade,
  Portfolio,
} from "./types";
import { money, num, pct } from "./format";
import { Empty, Label } from "./ui";
import Chart from "./Chart";
import DeskPanel from "./DeskPanel";
function WatchRow({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    if (rowRef.current) observer.observe(rowRef.current);
    return () => observer.disconnect();
  }, []);
  const { data } = useApi<Snapshot>(
    "market",
    "/market/" + encodeURIComponent(asset.symbol) + "/candles",
    60000,
    inView || selected,
  );
  return (
    <button
      ref={rowRef}
      className={"watch-row " + (selected ? "selected" : "")}
      onClick={onSelect}
    >
      <div>
        <b>{asset.symbol.replace("/USD", "")}</b>
        <span className="mono">{data ? num(data.price) : "\u2014"}</span>
      </div>
      <div>
        <small>{asset.name}</small>
        <span
          className={
            "mono " + (data && data.change < 0 ? "negative" : "positive")
          }
        >
          {data
            ? pct(data.change)
            : inView || selected
              ? "Connecting"
              : asset.market === "stock"
                ? "Stock"
                : "Crypto"}
        </span>
      </div>
    </button>
  );
}
export default function Terminal({
  events,
  status,
  selected,
  setSelected,
  operatorToken,
}: {
  events: DeskEvent[];
  status?: Status;
  selected: string;
  setSelected: (s: string) => void;
  operatorToken: string;
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIndicators, setIndicators] = useState(["ema21", "ema50"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const { data: assets = [] } = useApi<Asset[]>("assets", "/assets");
  const {
    data: snapshot,
    error,
    isFetching,
    refetch,
  } = useApi<Snapshot>(
    "market",
    "/market/" + encodeURIComponent(selected) + "/candles",
    60000,
  );
  const { data: trades = [] } = useApi<Trade[]>("trades", "/trades");
  const { data: book } = useApi<Portfolio>("portfolio", "/portfolio");
  const { data: quote } = useApi<{ price: number }>(
    "quote",
    "/market/" + encodeURIComponent(selected) + "/quote",
    20000,
  );
  const onTrade = useCallback(
    (id: string) => navigate("/decisions/" + id),
    [navigate],
  );
  const visible = useMemo(
    () =>
      assets.filter(
        (a) =>
          (filter === "all" || a.market === filter) &&
          (a.symbol + a.name).toLowerCase().includes(search.toLowerCase()),
      ),
    [assets, filter, search],
  );
  async function run() {
    setBusy(true);
    setNotice("");
    try {
      await analyze(selected, operatorToken);
      setNotice("Research queued. Follow the six desks for live reports.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="terminal-layout">
      <aside className="watchlist">
        <div className="panel-title">
          <Star size={15} />
          <b>WATCHLIST</b>
          <span className="tag">{assets.length} ASSETS</span>
        </div>
        <div className="watch-controls">
          <div className="tabs">
            {["all", "stock", "crypto"].map((x) => (
              <button
                key={x}
                className={filter === x ? "active" : ""}
                onClick={() => setFilter(x)}
              >
                {x === "all" ? "All" : x === "stock" ? "Stocks" : "Crypto"}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={14} />
            <input
              aria-label="Search watchlist"
              placeholder="Find an asset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="watch-rows">
          {visible.map((a) => (
            <WatchRow
              asset={a}
              selected={a.symbol === selected}
              key={a.symbol}
              onSelect={() => setSelected(a.symbol)}
            />
          ))}
          {!visible.length && <p className="muted pad">No matching assets.</p>}
        </div>
        <div className="watch-footer">
          <Label>PAPER PORTFOLIO</Label>
          <b className="mono">{money(book?.equity)}</b>
          <span className="muted">Persistent · No leverage</span>
        </div>
      </aside>
      <main className="chart-panel">
        <div className="asset-header">
          <div>
            <div className="asset-name">
              <h1>{selected.replace("/USD", "")}</h1>
              <span>{assets.find((a) => a.symbol === selected)?.name}</span>
              <span className="tag">
                {selected.includes("/") ? "CRYPTO" : "STOCK"}
              </span>
            </div>
            <div className="asset-price mono">
              {money(quote?.price ?? snapshot?.price)}{" "}
              <span
                className={
                  snapshot && snapshot.change < 0 ? "negative" : "positive"
                }
              >
                {pct(snapshot?.change)}
              </span>
            </div>
          </div>
          <div className="ohlc mono">
            {snapshot &&
              ["open", "high", "low", "close"].map((k) => (
                <span key={k}>
                  {k[0].toUpperCase()}{" "}
                  <b>{num(snapshot.candles.at(-1)?.[k as "open"])}</b>
                </span>
              ))}
          </div>
        </div>
        <div className="chart-toolbar">
          <span className="tag positive">1D CANDLES</span>
          <div className="indicator-toggles">
            {[
              "ema9",
              "ema21",
              "ema50",
              "vwap",
              "bollinger_upper",
              "bollinger_lower",
            ].map((k) => (
              <button
                key={k}
                className={selectedIndicators.includes(k) ? "active" : ""}
                onClick={() =>
                  setIndicators((old) =>
                    old.includes(k) ? old.filter((x) => x !== k) : [...old, k],
                  )
                }
              >
                {k.replace("bollinger_", "BB ").toUpperCase()}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            aria-label="Refresh chart"
            onClick={() => void refetch()}
          >
            <RefreshCw size={14} className={isFetching ? "spin" : ""} />
          </button>
        </div>
        <div className="chart-surface">
          {snapshot ? (
            <Chart
              snapshot={snapshot}
              indicators={selectedIndicators}
              trades={trades}
              onTrade={onTrade}
            />
          ) : (
            <Empty
              title={
                error ? "Market data unavailable" : "Connecting to the market"
              }
            >
              {error
                ? (error as Error).message
                : "Requesting real historical candles from public market sources."}
            </Empty>
          )}
        </div>
        <div className="chart-meta mono">
          <span className={snapshot?.stale ? "warning" : "muted"}>
            {snapshot
              ? (snapshot.stale ? "STALE · " : "") +
                snapshot.source.toUpperCase()
              : "CONNECTING"}{" "}
            ·{" "}
            {snapshot
              ? "AS OF " + new Date(snapshot.market_timestamp).toLocaleString()
              : "NO SYNTHETIC DATA"}
          </span>
          <span>PAPER MARKERS · DAILY HISTORY</span>
        </div>
        <div className="analytics-bar">
          {[
            ["RSI (14)", "rsi14"],
            ["MACD", "macd_histogram"],
            ["ATR (14)", "atr14"],
            ["VOLUME RATIO", "volume_ratio"],
            ["TREND", "trend"],
          ].map(([label, key]) => (
            <div key={key}>
              <Label>{label}</Label>
              <b className="mono">
                {typeof snapshot?.indicators.latest[key] === "number"
                  ? num(snapshot.indicators.latest[key] as number)
                  : snapshot?.indicators.latest[key] || "\u2014"}
              </b>
            </div>
          ))}
        </div>
        <div className="analysis-action">
          <div>
            <ShieldCheck size={17} />
            <span>
              Research is advisory. Every paper order passes deterministic risk
              checks.
            </span>
          </div>
          <button
            className="button primary small"
            onClick={() => void run()}
            disabled={
              busy ||
              !snapshot ||
              snapshot.stale ||
              status?.agent_network === "configuration_required"
            }
          >
            <Play size={14} />
            {busy ? "Queuing..." : "Run analysis"}
          </button>
        </div>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
      </main>
      <DeskPanel symbol={selected} events={events} status={status} />
    </div>
  );
}
