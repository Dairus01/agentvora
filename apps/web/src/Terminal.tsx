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
import { useQuoteState, type Quote } from "./useLiveMarket";
import type { ChartStyle } from "./live";
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
  const { data: quote, error: quoteError } = useApi<Quote>("quote", "/market/" + encodeURIComponent(asset.symbol) + "/quote", 8000, inView || selected);
  const price = quote?.price;
  return (
    <button
      ref={rowRef}
      className={"watch-row " + (selected ? "selected" : "")}
      onClick={onSelect}
    >
      <div>
        <b>{asset.symbol.replace("/USD", "")}</b>
        <span className="mono live-number" key={price}>{num(price)}</span>
      </div>
      <div>
        <small>{asset.name}</small>
        <span
          className={
            "mono " + ((quote?.change ?? 0) < 0 ? "negative" : "positive")
          }
        >
          {quote
            ? pct(quote.change)
            : quoteError
              ? "Unavailable"
              : inView || selected
              ? "Loading quote"
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
  const [interval, setInterval] = useState("1m");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candles");
  const { data: assets = [] } = useApi<Asset[]>("assets", "/assets");
  const {
    data: snapshot,
    error,
    isFetching,
    refetch,
  } = useApi<Snapshot>(
    "market",
    "/market/" + encodeURIComponent(selected) + "/candles?interval=" + interval,
    20000,
  );
  const { data: trades = [] } = useApi<Trade[]>("trades", "/trades");
  const { data: book } = useApi<Portfolio>("portfolio", "/portfolio");
  const { data: quote, error: quoteError } = useApi<Quote>(
    "quote",
    "/market/" + encodeURIComponent(selected) + "/quote",
    8000,
  );
  const quoteState = useQuoteState(quote);
  const feedState = quote ? quoteState : quoteError ? "quote unavailable" : snapshot ? "history loaded" : error ? "unavailable" : "loading history";
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
          <Label>TESTNET PORTFOLIO</Label>
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
          <div className="interval-controls" aria-label="Candle interval">
            {["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map(value => <button key={value} aria-pressed={interval === value} className={interval === value ? "active" : ""} onClick={() => setInterval(value)}>{value}</button>)}
          </div>
          <select aria-label="Chart style" value={chartStyle} onChange={e => setChartStyle(e.target.value as ChartStyle)}>
            <option value="candles">Candles</option><option value="heikin">Heikin Ashi</option><option value="bars">OHLC bars</option><option value="line">Line</option><option value="area">Area</option>
          </select>
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
              style={chartStyle}
            />
          ) : (
            <Empty
              title={
                error ? "Market data unavailable" : "Loading candle history"
              }
            >
              {error
                ? (error as Error).message
                : "Fetching " + interval + " candles for " + selected + ". Public feeds can take a few seconds."}
            </Empty>
          )}
        </div>
        <div className="chart-meta mono">
          <span className={snapshot?.stale || quoteState === "stale" ? "warning" : "muted"}>
            <b className="feed-state">{feedState.toUpperCase()}</b>{" · "}
            {snapshot
              ? (snapshot.stale ? "STALE · " : "") +
                snapshot.source.toUpperCase()
              : error ? "UNAVAILABLE" : "REQUESTING CANDLES"}{" "}
            ·{" "}
            {snapshot
              ? "AS OF " + new Date(quote?.timestamp || snapshot.market_timestamp).toLocaleString()
              : "NO SYNTHETIC DATA"}
          </span>
          <span>TESTNET MARKERS · {interval.toUpperCase()} HISTORY{chartStyle === "heikin" ? " · DERIVED HEIKIN ASHI" : ""}</span>
        </div>
        {quoteState === "market closed" && <div className="market-closure">US stock session is closed. Showing the last session; prices resume when trading opens. <button onClick={() => setSelected("BTC/USD")}>View live Bitcoin</button></div>}
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
              Research is advisory. Every testnet order passes deterministic risk
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
