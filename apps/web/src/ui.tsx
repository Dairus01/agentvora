import { Activity, Sun, Moon, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Activity size={21} />
      </span>
      <span>Agentvora</span>
    </Link>
  );
}
export function Theme() {
  const [light, setLight] = useState(
    document.documentElement.dataset.theme === "light",
  );
  return (
    <button
      className="icon-button"
      aria-label="Toggle color theme"
      onClick={() => {
        document.documentElement.dataset.theme = light ? "dark" : "light";
        setLight(!light);
        window.dispatchEvent(new Event("resize"));
      }}
    >
      {light ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Activity size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Label({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
export function External({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <ArrowUpRight size={13} />
    </a>
  );
}
