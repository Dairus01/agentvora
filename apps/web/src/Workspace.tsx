import { useState } from "react";
import { NavLink, Routes, Route, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  GitBranch,
  History,
  Code2,
  Menu,
  Settings,
  ArrowLeft,
  Radio,
} from "lucide-react";
import { useApi, useEvents } from "./api";
import type { Status } from "./types";
import { Brand, Theme } from "./ui";
import Terminal from "./Terminal";
import {
  PortfolioPage,
  DecisionsPage,
  DecisionPage,
  SourcePage,
  CouncilPage,
} from "./pages";
export default function Workspace() {
  const { data: status, error } = useApi<Status>("status", "/system/status");
  const { events, connected } = useEvents();
  const [selected, setSelected] = useState("MSFT");
  const [nav, setNav] = useState(false);
  const [settingsOpen, setSettings] = useState(false);
  const [operatorToken, setToken] = useState("");
  return (
    <div className="workspace">
      <header className="terminal-header">
        <div className="header-brand">
          <Link
            className="icon-button back"
            to="/"
            aria-label="Back to landing"
          >
            <ArrowLeft size={17} />
          </Link>
          <Brand />
          <span className="tag paper">PAPER</span>
        </div>
        <button
          className="icon-button mobile-menu"
          onClick={() => setNav(!nav)}
          aria-label="Toggle navigation"
        >
          <Menu size={19} />
        </button>
        <nav className={nav ? "open" : ""} aria-label="Workspace navigation">
          {[
            ["/terminal", LayoutDashboard, "Terminal"],
            ["/council", GitBranch, "Council"],
            ["/portfolio", Wallet, "Portfolio"],
            ["/decisions", History, "Decisions"],
            ["/source", Code2, "Source"],
          ].map(([to, Icon, label]) => {
            const I = Icon as typeof Menu;
            return (
              <NavLink
                key={String(to)}
                to={String(to)}
                onClick={() => setNav(false)}
              >
                <I size={14} />
                {String(label)}
              </NavLink>
            );
          })}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Operator settings"
            onClick={() => setSettings(!settingsOpen)}
          >
            <Settings size={16} />
          </button>
          <Theme />
          <span className="connection mono">
            <span className={"dot " + (connected ? "" : "dim")} />
            {connected ? "EVENT STREAM" : "RECONNECTING"}
          </span>
        </div>
      </header>
      {settingsOpen && (
        <div className="settings-panel">
          <label>
            Operator access token{" "}
            <input
              type="password"
              value={operatorToken}
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
              placeholder="Required for remote analysis controls"
            />
          </label>
          <small className="muted">Held in memory for this tab only.</small>
          <button className="button small" onClick={() => setSettings(false)}>
            Done
          </button>
        </div>
      )}
      {error && (
        <div className="notice warning">
          Backend unavailable. Retrying connection...
        </div>
      )}
      <Routes>
        <Route
          path="terminal"
          element={
            <Terminal
              selected={selected}
              setSelected={setSelected}
              status={status}
              events={events}
              operatorToken={operatorToken}
            />
          }
        />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="decisions" element={<DecisionsPage />} />
        <Route path="decisions/:id" element={<DecisionPage />} />
        <Route
          path="council"
          element={<CouncilPage symbol={selected} events={events} />}
        />
        <Route path="source" element={<SourcePage status={status} />} />
        <Route path="about" element={<SourcePage status={status} />} />
        <Route
          path="*"
          element={
            <div className="empty">
              <h1>Page not found</h1>
              <Link to="/terminal">Open terminal</Link>
            </div>
          }
        />
      </Routes>
      <div className="system-bar mono">
        <span>
          <Radio size={11} /> MARKET DATA{" "}
          <b>{error ? "UNAVAILABLE" : "PUBLIC SOURCES"}</b>
        </span>
        <span>
          AGENT NETWORK{" "}
          <b>
            {status?.agent_network === "ready"
              ? "READY"
              : status
                ? "CONFIGURATION REQUIRED"
                : "CONNECTING"}
          </b>
        </span>
        <span>
          AUTONOMOUS{" "}
          <b>
            {status?.autonomous_status.replaceAll("_", " ").toUpperCase() ||
              "CONNECTING"}
          </b>
        </span>
        <span className="positive">PAPER EXECUTION · ACTIVE</span>
      </div>
    </div>
  );
}
