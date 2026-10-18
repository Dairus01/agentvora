import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Radio,
  ChartNoAxesCombined,
  ShieldCheck,
  MessageSquare,
  Layers,
  Code2,
  Search,
  Scale,
} from "lucide-react";
import { useApi } from "./api";
import { Brand, Theme, Label } from "./ui";
import { money, pct } from "./format";
import type { Snapshot } from "./types";
function MarketCard({
  symbol,
  name,
  index,
}: {
  symbol: string;
  name: string;
  index: number;
}) {
  const { data } = useApi<Snapshot>(
    "market",
    "/market/" + encodeURIComponent(symbol) + "/candles",
    60000,
  );
  const rows = data?.candles.slice(-25) || [];
  const min = Math.min(...rows.map((c) => c.close)),
    max = Math.max(...rows.map((c) => c.close));
  const points = rows
    .map(
      (c, i) =>
        `${(i / (rows.length - 1)) * 260},${55 - ((c.close - min) / (max - min || 1)) * 40}`,
    )
    .join(" ");
  return (
    <div className={"market-card market-card-" + index}>
      <div className="card-heading">
        <b>{symbol.replace("/USD", "")}</b>
        <ChartNoAxesCombined size={18} />
      </div>
      <small>{name}</small>
      <div className="quote">
        {data ? money(data.price) : "\u2014"}{" "}
        <span className={data && data.change < 0 ? "negative" : "positive"}>
          {data ? pct(data.change) : "Awaiting data"}
        </span>
      </div>
      <svg
        viewBox="0 0 260 70"
        role="img"
        aria-label={`${symbol} recent closing prices`}
      >
        <defs>
          <linearGradient id={"fill" + index} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#00d69b" stopOpacity=".3" />
            <stop offset="1" stopColor="#00d69b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {rows.length > 0 && (
          <>
            <polygon
              points={"0,70 " + points + " 260,70"}
              fill={`url(#fill${index})`}
            />
            <polyline
              points={points}
              fill="none"
              stroke="#10dca0"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <div className="mono muted card-foot">
        <Activity size={12} />
        {data
          ? data.stale
            ? "CACHED MARKET DATA"
            : "MARKET TRACKING"
          : "CONNECTING"}
        <span className={"dot " + (data ? "" : "dim")} />
      </div>
    </div>
  );
}
function SignalCard({ symbol }: { symbol: string }) {
  const { data } = useApi<Snapshot>(
    "market",
    "/market/" + encodeURIComponent(symbol) + "/candles",
    60000,
  );
  const m = data?.indicators.latest;
  return (
    <article className="signal-card">
      <div className="card-heading">
        <b>{symbol.replace("/USD", "")}</b>
        <span className="tag positive">
          {String(m?.trend || "CONNECTING").toUpperCase()}
        </span>
      </div>
      <div className="signal-metrics">
        <div>
          <Label>RSI (14)</Label>
          <b>{typeof m?.rsi14 === "number" ? m.rsi14.toFixed(1) : "—"}</b>
        </div>
        <div>
          <Label>MOMENTUM</Label>
          <b>{String(m?.momentum || "—").toUpperCase()}</b>
        </div>
        <div>
          <Label>VOLUME RATIO</Label>
          <b>
            {typeof m?.volume_ratio === "number"
              ? m.volume_ratio.toFixed(2) + "×"
              : "—"}
          </b>
        </div>
      </div>
      <small className="mono muted">
        DETERMINISTIC MARKET SIGNALS · NO SOCIAL INFERENCE
      </small>
    </article>
  );
}
function CuratedLists() {
  const { data } = useApi<{
    groups: { name: string; description: string; symbols: string[] }[];
    as_of: string | null;
  }>("watchlists", "/watchlists");
  return (
    <div className="watchlist-preview category-lists">
      {data ? (
        data.groups.map((group) => (
          <div key={group.name}>
            <Label>MARKET DESK SCAN</Label>
            <h3>{group.name}</h3>
            <p>{group.description}</p>
            <div className="scan-symbols">
              {group.symbols.length ? (
                group.symbols.map((symbol) => (
                  <span className="tag" key={symbol}>
                    {symbol}
                  </span>
                ))
              ) : (
                <small className="muted">
                  No qualifying assets in available evidence.
                </small>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="pad">Loading market desk scans…</p>
      )}
    </div>
  );
}
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Landing navigation">
          <a href="#intelligence">Intelligence</a>
          <a href="#commentary">Commentary</a>
          <a href="#sentiment">Sentiment</a>
          <a href="#watchlists">Watchlists</a>
        </nav>
        <div className="header-actions">
          <Theme />
          <Link className="button primary small" to="/terminal">
            Launch <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <div className="ticker-strip">
        <span>
          <Radio size={12} /> STOCKS & CRYPTO
        </span>
        <span>AAPL · MSFT · NVDA · TSLA</span>
        <span>BTC / USD · ETH / USD · SOL / USD</span>
        <span className="positive">AUTONOMOUS RESEARCH · PAPER EXECUTION</span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <span className="dot" /> AUTONOMOUS MARKET INTELLIGENCE
          </div>
          <h1>
            The market,
            <br />
            <em>decoded</em>
            <br />
            in real time.
          </h1>
          <p>
            Agentvora is an AI-native market intelligence platform.
            <br />
            Autonomous analyst agents read the tape, decode flow, and stream
            institutional-grade commentary alongside every chart, continuously.
          </p>
          <div className="actions">
            <Link className="button primary" to="/terminal">
              Launch Terminal <ArrowRight size={18} />
            </Link>
            <a className="button" href="#commentary">
              See AI in action
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <Label>
                <Layers size={14} /> ANALYST DESKS
              </Label>
              <b>6 coordinated</b>
            </div>
            <div>
              <Label>
                <ShieldCheck size={14} /> EXECUTION
              </Label>
              <b>Paper only</b>
            </div>
            <div>
              <Label>
                <Activity size={14} /> RESEARCH
              </Label>
              <b>Continuous</b>
            </div>
          </div>
        </div>
        <div className="market-cards" aria-label="Real market snapshots">
          <MarketCard symbol="NVDA" name="NVIDIA CORPORATION" index={0} />
          <MarketCard symbol="AAPL" name="APPLE INC." index={1} />
          <MarketCard symbol="BTC/USD" name="BITCOIN / US DOLLAR" index={2} />
          <MarketCard symbol="ETH/USD" name="ETHEREUM / US DOLLAR" index={3} />
        </div>
      </section>
      <section id="intelligence" className="landing-section">
        <Label>AI INTELLIGENCE</Label>
        <h2>
          Not a chatbot. An <em>analyst desk.</em>
        </h2>
        <p className="section-intro">
          Every Agentvora analysis convenes a coordinated team of specialized
          agents. Each one watches one thing extremely well, and they challenge
          one another before a decision reaches the portfolio.
        </p>
        <div className="feature-grid">
          {[
            [
              Search,
              "Autonomous analyst agents",
              "Market, fundamentals, news and sentiment analysts independently evaluate the evidence.",
            ],
            [
              Radio,
              "A shared market surface",
              "Price action and analyst reports stay together on the same surface, with source timestamps visible.",
            ],
            [
              ChartNoAxesCombined,
              "Institutional indicators",
              "RSI, EMA, VWAP, MACD, momentum and ATR computed locally in Python. No third-party indicator service to fail.",
            ],
            [
              Scale,
              "Built for clarity",
              "Bull and bear researchers debate the evidence. A deterministic risk gate evaluates every paper order.",
            ],
            [
              MessageSquare,
              "Headline-aware AI",
              "The news desk reads recent source-linked headlines, classifies events and makes missing information explicit.",
            ],
            [
              Layers,
              "Coordinated agents",
              "Specialist analysts work in parallel, then publish into a shared council and risk review.",
            ],
            [
              Activity,
              "Streaming commentary",
              "Explicit analyst reports arrive as each role completes. Every status reflects actual execution.",
            ],
            [
              ShieldCheck,
              "Accountable decisions",
              "Research, constraints and paper fills form one persistent record that you can inspect.",
            ],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Search;
            return (
              <article key={String(title)}>
                <I size={23} />
                <h3>{String(title)}</h3>
                <p>{String(body)}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section id="commentary" className="landing-section split">
        <div>
          <Label>LIVE COMMENTARY</Label>
          <h2>
            The AI writes back,
            <br />
            <em>continuously.</em>
          </h2>
          <p>
            Agents stream explicit reports into a shared feed. Every line
            references evidence and real price levels. This is the desk's public
            research record.
          </p>
          <div className="mini-grid">
            <div>
              <Label>RESEARCH CADENCE</Label>
              <b>30 minutes</b>
            </div>
            <div>
              <Label>DELIVERY</Label>
              <b>Live stream</b>
            </div>
            <div>
              <Label>DESKS</Label>
              <b>6 coordinated</b>
            </div>
            <div>
              <Label>TONE</Label>
              <b>Institutional</b>
            </div>
          </div>
        </div>
        <div className="research-preview">
          <div className="panel-title">
            <Activity size={15} /> MULTI-AGENT DESK{" "}
            <span className="tag">WORKFLOW</span>
          </div>
          {[
            ["MARKET DESK", "Price structure, momentum and volatility."],
            [
              "RESEARCH COUNCIL",
              "Bull case. Bear case. An evidence-led synthesis.",
            ],
            [
              "RISK & PORTFOLIO",
              "Constraint checks, explicit decisions, persistent paper accounting.",
            ],
          ].map(([title, body]) => (
            <div className="preview-report" key={title}>
              <Label>{title}</Label>
              <p>{body}</p>
            </div>
          ))}
          <Link to="/council" className="text-link">
            Explore the council <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section id="sentiment" className="landing-section">
        <Label>SENTIMENT SURFACE</Label>
        <h2>
          Positioning read at a <em>glance.</em>
        </h2>
        <p className="section-intro">
          Trend, momentum and volatility from deterministic analytics. Public
          analyst reports distinguish market signals from social data, and make
          gaps in the evidence explicit.
        </p>
        <div className="signal-grid">
          {["NVDA", "AAPL", "BTC/USD"].map((symbol) => (
            <SignalCard key={symbol} symbol={symbol} />
          ))}
        </div>
        <div className="process-line">
          <span>MARKET EVIDENCE</span>
          <ArrowRight />
          <span>INDEPENDENT REPORTS</span>
          <ArrowRight />
          <span>BULL / BEAR COUNCIL</span>
          <ArrowRight />
          <span>RISK REVIEW</span>
        </div>
      </section>
      <section id="watchlists" className="landing-section">
        <div>
          <Label>AI WATCHLISTS</Label>
          <h2>
            Curated by agents,
            <br />
            <em>not editors.</em>
          </h2>
          <p>
            Market desk scans curate membership from the same verified trend,
            momentum and participation signals used in research. Lists change
            with the evidence, never on a press cycle.
          </p>
          <Link className="text-link" to="/terminal">
            Explore the watchlist <ArrowRight size={16} />
          </Link>
        </div>
        <CuratedLists />
      </section>
      <section className="landing-section split">
        <div>
          <Label>REALTIME ANALYTICS</Label>
          <h2>
            Indicators computed on <em>every update.</em>
          </h2>
          <p>
            RSI, MACD, EMA, VWAP, ATR, momentum and market participation are
            recomputed from verified candles. The analysts see what you see,
            with the same source timestamps.
          </p>
        </div>
        <div className="mini-grid analytics-preview">
          {[
            "RSI (14)",
            "MACD",
            "EMA 21",
            "EMA 50",
            "VWAP",
            "ATR (14)",
            "MOMENTUM",
            "VOLUME RATIO",
          ].map((label) => (
            <div key={label}>
              <Label>{label}</Label>
              <span>Computed in Python</span>
            </div>
          ))}
        </div>
      </section>
      <section className="closing">
        <div className="pill">THE AGENTVORA TERMINAL</div>
        <h2>
          Open the terminal.
          <br />
          <em>Hear the desk think.</em>
        </h2>
        <p>
          Pick an asset, follow the research and inspect every decision.
          <br />
          An autonomous paper portfolio. Institutional tone. No hype.
        </p>
        <div className="actions">
          <Link className="button primary" to="/terminal">
            Launch Terminal <ArrowRight size={17} />
          </Link>
          <Link className="button" to="/source">
            <Code2 size={16} /> Explore source
          </Link>
        </div>
        <small className="mono muted">
          NO SIGNUP · NO BROKER CONNECT · PAPER EXECUTION
        </small>
      </section>
      <footer>
        <Brand />
        <p>
          Autonomous market intelligence.
          <br />
          Research and paper trading. Capital is simulated.
        </p>
        <div>
          <Link to="/terminal">Terminal</Link>
          <Link to="/council">Council</Link>
          <Link to="/portfolio">Portfolio</Link>
          <Link to="/source">Source</Link>
        </div>
        <small>© {new Date().getFullYear()} Agentvora</small>
      </footer>
    </div>
  );
}
