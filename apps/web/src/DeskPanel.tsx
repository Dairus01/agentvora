import { Activity, ChevronDown, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { DeskEvent, Status, Run } from "./types";
import { Label, Empty } from "./ui";
import { date } from "./format";
import { useApi } from "./api";
export const desks = [
  {
    id: "market",
    name: "Market Desk",
    agents: ["Market Analyst"],
    description: "Price structure · momentum · volatility",
  },
  {
    id: "fundamentals",
    name: "Fundamentals Desk",
    agents: ["Fundamentals Analyst"],
    description: "Financials · asset fundamentals",
  },
  {
    id: "news",
    name: "News Desk",
    agents: ["News Analyst"],
    description: "Events · sources · freshness",
  },
  {
    id: "sentiment",
    name: "Sentiment Desk",
    agents: ["Sentiment Analyst"],
    description: "Positioning · evidence quality",
  },
  {
    id: "research",
    name: "Research Council",
    agents: [
      "Bull Researcher",
      "Bear Researcher",
      "Research Manager",
      "Trader",
    ],
    description: "Bull versus bear · synthesis · proposal",
  },
  {
    id: "risk",
    name: "Risk & Portfolio",
    agents: [
      "Aggressive Analyst",
      "Neutral Analyst",
      "Conservative Analyst",
      "Portfolio Manager",
    ],
    description: "Risk review · sizing · final decision",
  },
];
export default function DeskPanel({
  symbol,
  events,
  status,
}: {
  symbol: string;
  events: DeskEvent[];
  status?: Status;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const relevant = events.filter((e) => e.asset === symbol);
  const { data: runs = [] } = useApi<Run[]>("runs", "/runs");
  const latestRun =
    relevant.find((e) => e.run_id)?.run_id ||
    runs.find((r) => r.symbol === symbol)?.id;
  const { data: run } = useApi<Run>(
    "run",
    "/runs/" + latestRun,
    30000,
    !!latestRun,
  );
  const reports = run?.reports || [];
  return (
    <aside className="desk-panel" data-testid="agent-panel">
      <div className="panel-title">
        <Activity size={16} />
        <b>AI INTELLIGENCE</b>
        <span className="tag">6 DESKS</span>
      </div>
      <div className="desks">
        {desks.map((d) => {
          const latest = relevant.find((e) => e.desk === d.id);
          const state = latest?.status || "idle";
          return (
            <div
              className={"desk " + (expanded === d.id ? "expanded" : "")}
              key={d.id}
            >
              <button
                className="desk-toggle"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                aria-expanded={expanded === d.id}
              >
                <span>
                  <b>{d.name}</b>
                  <small>{d.description}</small>
                </span>
                <span className={"desk-status " + state}>
                  {state.toUpperCase()} <ChevronDown size={12} />
                </span>
              </button>
              {expanded === d.id && (
                <div className="desk-agents">
                  {d.agents.map((a) => {
                    const event = relevant.find(
                      (e) => e.agent === a && e.summary,
                    );
                    const report =
                      event?.summary ||
                      reports.find((r) => r.agent === a)?.report;
                    return (
                      <div key={a}>
                        <Label>{a}</Label>
                        <p className="report-text">
                          {report ||
                            "Awaiting an executed analysis. Reports appear here as each agent completes."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="feed-title">
        <Label>COMMENTARY FEED · {symbol.replace("/USD", "")}</Label>
        <span className="positive mono">PUBLIC REPORTS</span>
      </div>
      <div className="event-feed">
        {status?.agent_network === "configuration_required" && (
          <div className="configuration">
            <Label>CONFIGURATION REQUIRED</Label>
            <h3>The desk is standing by.</h3>
            <p>
              Market data and portfolio tools are available. Configure the agent
              service on the server to begin research.
            </p>
          </div>
        )}
        {relevant
          .filter((e) => e.summary)
          .slice(0, 30)
          .map((e) => (
            <article className="event-card" key={e.id}>
              <div>
                <Label>{e.agent || e.desk}</Label>
                <span className="tag">
                  {e.type === "debate.argument" ? "COUNCIL" : "REPORT"}
                </span>
              </div>
              <p className="report-text">{e.summary}</p>
              <small className="mono muted">
                {date(e.timestamp)}
                {e.confidence != null
                  ? ` · CONF ${Math.round(e.confidence * 100)}%`
                  : ""}
              </small>
            </article>
          ))}
        {!relevant.some((e) => e.summary) &&
          status?.agent_network !== "configuration_required" && (
            <Empty title="Ready for research">
              Run an analysis to watch independent reports converge into a
              portfolio decision.
            </Empty>
          )}
      </div>
      <div className="panel-foot">
        <Activity size={12} /> MULTI-AGENT DESK{" "}
        <span className="positive">PAPER</span>
      </div>
    </aside>
  );
}
