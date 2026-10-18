import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Report({ text, animate = false, compact = false }: { text: string; animate?: boolean; compact?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(animate ? 0 : text.length);
  const [expanded, setExpanded] = useState(!compact);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    const change = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", change); };
  }, []);
  useEffect(() => { setCount(animate ? 0 : text.length); }, [text, animate]);
  useEffect(() => {
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { setCount(text.length); return; }
    if (!visible || !pageVisible) return;
    const timer = setInterval(() => setCount(old => Math.min(text.length, old + Math.max(4, Math.ceil(text.length / 120)))), 25);
    return () => clearInterval(timer);
  }, [text, animate, visible, pageVisible]);
  const typing = animate && count < text.length;
  return <div ref={root} className={"report-block " + (compact && !expanded ? "report-collapsed" : "")}>
    <div className={"report-markdown " + (typing ? "typing-report" : "")}>
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
        table: ({ children }) => <div className="report-table"><table>{children}</table></div>,
      }}>{typing ? text.slice(0, count) : text}</Markdown>
    </div>
    {compact && <button className="report-expand" onClick={() => setExpanded(old => !old)}>{expanded ? "Collapse report" : "Read full report"}</button>}
  </div>;
}
