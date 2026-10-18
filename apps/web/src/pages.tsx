import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Code2,
  ShieldCheck,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useApi, API_ORIGIN } from "./api";
import { money, num, pct, date, safeUrl } from "./format";
import { Empty, Label, External } from "./ui";
import { desks } from "./DeskPanel";
import type {
  Portfolio,
  Trade,
  Decision,
  Status,
  DeskEvent,
  Run,
} from "./types";
function PageTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <Label>{label}</Label>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="metric">
      <Label>{label}</Label>
      <b className="mono">{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Curve({ values }: { values: number[] }) {
  if (values.length < 2)
    return (
      <Empty title="Your track record starts here">
        The equity curve grows as the paper portfolio is marked to market. No
        historical returns have been fabricated.
      </Empty>
    );
  const min = Math.min(...values) * 0.999,
    max = Math.max(...values) * 1.001;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 1000},${180 - ((v - min) / (max - min || 1)) * 160}`,
    )
    .join(" ");
  return (
    <svg
      className="equity-curve"
      viewBox="0 0 1000 210"
      role="img"
      aria-label="Paper portfolio equity curve"
    >
      <line x1="0" y1="180" x2="1000" y2="180" stroke="var(--border)" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
      />
    </svg>
  );
}
export function PortfolioPage() {
  const { data, error } = useApi<Portfolio>("portfolio", "/portfolio");
  const { data: trades = [] } = useApi<Trade[]>("trades", "/trades");
  const { data: history = [] } = useApi<
    { equity: number; timestamp: string }[]
  >("history", "/portfolio/history");
  const { data: performance } = useApi<Record<string, number | null>>(
    "performance",
    "/performance",
  );
  return (
    <main className="page">
      <PageTitle
        label="RISK & PORTFOLIO DESK · PAPER"
        title="Portfolio intelligence."
        description="A persistent record of capital, exposure and every executed decision."
      />
      {error && <div className="notice">Portfolio unavailable. Retrying…</div>}
      <div className="metrics-grid">
        <Metric
          label="NET ASSET VALUE"
          value={money(data?.equity)}
          sub="Simulated capital"
        />
        <Metric label="AVAILABLE CASH" value={money(data?.cash)} />
        <Metric label="INVESTED CAPITAL" value={money(data?.invested)} />
        <Metric
          label="TOTAL RETURN"
          value={pct(data?.total_return)}
          sub={"Today " + pct(data?.today_return)}
        />
        <Metric label="UNREALIZED P&L" value={money(data?.unrealized_pnl)} />
        <Metric label="REALIZED P&L" value={money(data?.realized_pnl)} />
      </div>
      <div className="portfolio-charts">
        <section className="panel">
          <div className="panel-title">
            EQUITY CURVE <span className="tag">PAPER · SINCE INCEPTION</span>
          </div>
          <Curve values={history.map((x) => x.equity)} />
        </section>
        <section className="panel allocation">
          <div className="panel-title">CAPITAL ALLOCATION</div>
          <div className="allocation-total mono">
            {data ? num((data.cash / data.equity) * 100) : "—"}
            <small>% CASH</small>
          </div>
          <div className="allocation-bar">
            <span
              style={{
                width: (data ? (data.cash / data.equity) * 100 : 100) + "%",
              }}
            />
          </div>
          <div className="allocation-legend">
            <span>
              Cash reserve <b>{money(data?.cash)}</b>
            </span>
            <span>
              Positions <b>{money(data?.invested)}</b>
            </span>
          </div>
          <p className="muted">
            20% maximum per position · 15% minimum cash reserve.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          OPEN POSITIONS{" "}
          <span className="tag">{data?.positions.length || 0}</span>
        </div>
        {data?.positions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Asset",
                    "Quantity",
                    "Avg. entry",
                    "Mark",
                    "Market value",
                    "Unrealized P&L",
                    "Return",
                    "Confidence",
                    "Reassessed",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.symbol}</b>
                    </td>
                    <td>{num(p.quantity, 6)}</td>
                    <td>{money(p.average_entry)}</td>
                    <td>{money(p.current_price)}</td>
                    <td>{money(p.market_value)}</td>
                    <td
                      className={
                        p.unrealized_pnl >= 0 ? "positive" : "negative"
                      }
                    >
                      {money(p.unrealized_pnl)}
                    </td>
                    <td>{pct(p.return_pct)}</td>
                    <td>{num(p.confidence * 100)}%</td>
                    <td>{date(p.last_reassessment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Capital ready. No positions yet.">
            Approved research decisions will open paper positions here. Your
            starting cash remains uninvested.
          </Empty>
        )}
      </section>
      <div className="metrics-grid performance-grid">
        {[
          ["COMPLETED TRADES", "completed_trades"],
          ["WIN RATE", "win_rate"],
          ["MAX DRAWDOWN", "max_drawdown"],
          ["DAILY SHARPE", "sharpe"],
          ["PROFIT FACTOR", "profit_factor"],
          ["ANALYSES", "analyses"],
        ].map(([label, key]) => (
          <Metric
            key={key}
            label={label}
            value={num(performance?.[key])}
            sub={key === "sharpe" ? "Requires 30 daily returns" : undefined}
          />
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">EXECUTION HISTORY</div>
        {trades.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Time",
                    "Asset",
                    "Side",
                    "Quantity",
                    "Fill price",
                    "Fees",
                    "Realized P&L",
                    "Decision",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td>{date(t.timestamp)}</td>
                    <td>{t.symbol}</td>
                    <td
                      className={t.action === "BUY" ? "positive" : "negative"}
                    >
                      {t.action}
                    </td>
                    <td>{num(t.quantity, 6)}</td>
                    <td>{money(t.price)}</td>
                    <td>{money(t.fee)}</td>
                    <td>{money(t.realized_pnl)}</td>
                    <td>
                      <Link to={"/decisions/" + t.decision_id}>
                        Inspect <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Every fill will have a paper trail.">
            Orders, transaction costs and realized results appear after the
            first approved paper execution.
          </Empty>
        )}
      </section>
    </main>
  );
}
export function DecisionsPage() {
  const { data = [], error } = useApi<Decision[]>("decisions", "/decisions");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const visible = data.filter(
    (d) =>
      (filter === "ALL" || d.action === filter) &&
      d.symbol.includes(query.toUpperCase()),
  );
  return (
    <main className="page">
      <PageTitle
        label="RESEARCH ARCHIVE"
        title="Every decision. Every reason."
        description="Inspect the evidence, the disagreement and the deterministic execution result."
      />
      <div className="archive-toolbar">
        <div className="tabs">
          {["ALL", "BUY", "SELL", "HOLD"].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <input
          aria-label="Filter decisions by asset"
          placeholder="Filter by asset…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <section className="panel">
        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Timestamp",
                    "Asset",
                    "Decision",
                    "Confidence",
                    "Summary",
                    "Risk gate",
                    "",
                  ].map((x, i) => (
                    <th key={i}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id}>
                    <td>{date(d.timestamp)}</td>
                    <td>
                      <b>{d.symbol}</b>
                      <small className="muted">{d.market}</small>
                    </td>
                    <td>
                      <span
                        className={
                          "tag " +
                          (d.action === "BUY"
                            ? "positive"
                            : d.action === "SELL"
                              ? "negative"
                              : "")
                        }
                      >
                        {d.action}
                      </span>
                    </td>
                    <td>{num(d.confidence * 100)}%</td>
                    <td className="summary-cell">{d.summary}</td>
                    <td>{d.execution}</td>
                    <td>
                      <Link
                        aria-label={"Inspect " + d.symbol + " decision"}
                        to={"/decisions/" + d.id}
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              error
                ? "Decision service unavailable"
                : "No decisions to inspect yet."
            }
          >
            {error
              ? "The archive will reconnect automatically."
              : "Completed council analyses appear here, including HOLD calls and rejected orders."}
          </Empty>
        )}
      </section>
    </main>
  );
}
export function DecisionPage() {
  const { id } = useParams();
  const { data: d, error } = useApi<Decision>("decision", "/decisions/" + id);
  if (!d)
    return (
      <main className="page">
        <Empty
          title={error ? "Decision unavailable" : "Loading research record…"}
        >
          <Link to="/decisions">Return to archive</Link>
        </Empty>
      </main>
    );
  const sections = [
    ["Market Analyst", d.market_view],
    ["Fundamentals Analyst", d.fundamental_view],
    ["News Analyst", d.news_view],
    ["Sentiment Analyst", d.sentiment_view],
    ["Bull case", d.bull_case],
    ["Bear case", d.bear_case],
    ["Research Manager", d.research_conclusion],
    ["Risk review", d.risk_conclusion],
    ["Portfolio Manager", d.portfolio_conclusion],
  ];
  return (
    <main className="page decision-page">
      <Link className="text-link" to="/decisions">
        ← Decision archive
      </Link>
      <PageTitle
        label={"PAPER · " + date(d.timestamp)}
        title={d.symbol + " / " + d.action}
        description={d.summary}
      />
      <div className="metrics-grid">
        <Metric
          label="ADVISORY CONFIDENCE"
          value={num(d.confidence * 100) + "%"}
        />
        <Metric label="REFERENCE PRICE" value={money(d.reference_price)} />
        <Metric
          label="REQUESTED ALLOCATION"
          value={num(d.requested_allocation * 100) + "%"}
        />
        <Metric
          label="APPROVED ALLOCATION"
          value={num(d.approved_allocation * 100) + "%"}
        />
        <Metric label="EXECUTION" value={d.execution.toUpperCase()} />
      </div>
      <div className="notice">
        <ShieldCheck size={18} />
        {d.execution_reason ||
          "Deterministic portfolio constraints passed. Paper execution recorded."}
      </div>
      <div className="decision-reports">
        {sections.map(([title, report]) => (
          <section className="panel" key={title}>
            <div className="panel-title">{title.toUpperCase()}</div>
            <p className="report-text">{report || "No report supplied."}</p>
          </section>
        ))}
      </div>
      <section className="panel sources">
        <div className="panel-title">SOURCES</div>
        {d.sources.length ? (
          d.sources.map(
            (s) =>
              safeUrl(s.url) && (
                <External key={s.url} href={s.url}>
                  {s.title}
                </External>
              ),
          )
        ) : (
          <p className="muted pad">
            No article sources were available. Market evidence is recorded with
            the analysis snapshot.
          </p>
        )}
      </section>
    </main>
  );
}
export function CouncilPage({
  symbol,
  events,
}: {
  symbol: string;
  events: DeskEvent[];
}) {
  const [selected, setSelected] = useState("Market Analyst");
  const { data: runs = [] } = useApi<Run[]>("runs", "/runs");
  const latestRun = runs.find((r) => r.symbol === symbol);
  const { data: run } = useApi<Run>(
    "run",
    "/runs/" + latestRun?.id,
    30000,
    !!latestRun,
  );
  const active = events.filter(
    (e) => e.asset === symbol && (!latestRun || e.run_id === latestRun.id),
  );
  const report =
    active.find((e) => e.agent === selected && e.summary)?.summary ||
    run?.reports?.find((r) => r.agent === selected)?.report;
  function node(agent: string) {
    const latest = active.find((e) => e.agent === agent);
    return (
      <button
        key={agent}
        className={
          "council-node " +
          (latest?.status || "idle") +
          " " +
          (selected === agent ? "selected" : "")
        }
        onClick={() => setSelected(agent)}
      >
        <Activity size={16} />
        <b>{agent}</b>
        <span className="mono">{(latest?.status || "idle").toUpperCase()}</span>
      </button>
    );
  }
  return (
    <main className="page">
      <PageTitle
        label={"AGENTVORA COUNCIL · " + symbol}
        title="Independent views. One accountable decision."
        description="Twelve specialized roles. Six coordinated desks. A deterministic gate between research and execution."
      />
      <div className="council-layout">
        <div className="council-graph">
          <div className="graph-row analysts">
            {desks.slice(0, 4).map((d) => node(d.agents[0]))}
          </div>
          <div className="connector">↓ EVIDENCE CONVERGES ↓</div>
          <div className="graph-row debate">
            {node("Bull Researcher")}
            <span className="mono muted">VS</span>
            {node("Bear Researcher")}
          </div>
          <div className="connector">↓</div>
          <div className="graph-row">
            {node("Research Manager")}
            <ArrowRight className="muted" />
            {node("Trader")}
          </div>
          <div className="connector">↓ RISK REVIEW ↓</div>
          <div className="graph-row">
            {[
              "Aggressive Analyst",
              "Neutral Analyst",
              "Conservative Analyst",
            ].map(node)}
          </div>
          <div className="connector">↓</div>
          <div className="graph-row">{node("Portfolio Manager")}</div>
          <div className="connector">↓ DETERMINISTIC CONSTRAINTS ↓</div>
          <div className="execution-node">
            <ShieldCheck size={20} />
            <b>PAPER EXECUTION</b>
            <span className="tag">NO LEVERAGE</span>
          </div>
        </div>
        <section className="panel council-report">
          <div className="panel-title">{selected.toUpperCase()}</div>
          {report ? (
            <p className="report-text">{report}</p>
          ) : (
            <Empty title="Awaiting an executed report">
              Select an agent to inspect its explicit report. Start research
              from the terminal.
            </Empty>
          )}
        </section>
      </div>
    </main>
  );
}
export function SourcePage({ status }: { status?: Status }) {
  return (
    <main className="page source-page">
      <PageTitle
        label="OPEN ARCHITECTURE"
        title="Inspect the system."
        description="From the market snapshot to the final paper fill. The source makes every boundary reviewable."
      />
      <div className="source-hero panel">
        <Code2 size={42} />
        <div>
          <h2>Agentvora source code</h2>
          <p>
            React interface. Python services. Multi agent research.
            <br />
            Deterministic analytics and a persistent paper ledger.
          </p>
          <div className="actions">
            {status?.source_available ? (
              <a
                className="button primary"
                href={API_ORIGIN + "/api/source/download"}
              >
                <Download size={16} /> Download Source
              </a>
            ) : (
              <span className="tag">SOURCE PACKAGE NOT BUILT</span>
            )}
            {status?.source_repository_url &&
              safeUrl(status.source_repository_url) && (
                <a
                  className="button"
                  href={status.source_repository_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Repository <ArrowRight size={16} />
                </a>
              )}
          </div>
        </div>
      </div>
      <div className="source-grid">
        {[
          [
            "MARKET & ANALYTICS",
            "Public stock and cryptocurrency feeds, source fallbacks and deterministic technical calculations.",
          ],
          [
            "RESEARCH COUNCIL",
            "Independent analyst reports, bull and bear debate, research synthesis and risk review.",
          ],
          [
            "PAPER EXECUTION",
            "Hard portfolio constraints, idempotent orders and persistent position accounting.",
          ],
          [
            "EVENT STREAM",
            "Actual execution statuses and explicit reports, delivered over a reconnecting WebSocket.",
          ],
        ].map(([title, body]) => (
          <article className="panel" key={title}>
            <Label>{title}</Label>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <section className="panel pad">
        <h3>Built on open research.</h3>
        <p>
          Agentvora integrates the TradingAgents framework by Tauric Research
          under Apache License 2.0. Attribution, upstream license text and
          dependency notices are included in the source package.
        </p>
        <p className="muted">
          Research and paper trading only. Results are simulated; there is no
          live-money execution path.
        </p>
      </section>
      <a
        className="text-link"
        href="https://www.tradingview.com/"
        target="_blank"
        rel="noreferrer"
      >
        Charts by TradingView
      </a>
    </main>
  );
}
