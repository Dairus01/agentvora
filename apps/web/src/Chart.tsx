import { useEffect, useRef, useState } from "react";
import type { Snapshot, Trade } from "./types";
import { heikinAshi, type ChartStyle } from "./live";

/** Original SVG renderer. Positions use observed bars; no synthetic price ticks. */
export default function Chart({ snapshot, indicators, trades, onTrade, style = "candles" }: { snapshot: Snapshot; indicators: string[]; trades: Trade[]; onTrade: (id: string) => void; style?: ChartStyle }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 510 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(280, entry.contentRect.height) }));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const [view, setView] = useState({ count: 100, offset: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; offset: number } | null>(null);
  const raw = snapshot.candles;
  const all = style === "heikin" ? heikinAshi(raw) : raw;
  const end = Math.max(1, all.length - Math.min(view.offset, Math.max(0, all.length - view.count)));
  const start = Math.max(0, end - view.count);
  const rows = all.slice(start, end);
  const W = size.width, H = size.height, left = 12, right = W - 83, top = 24, bottom = H - 125;
  const overlayValues = indicators.flatMap(key => (snapshot.indicators.series[key] || []).filter(p => p.time >= (rows[0]?.time || 0) && p.time <= (rows.at(-1)?.time || 0)).map(p => p.value));
  const lows = rows.map(c => c.low), highs = rows.map(c => c.high);
  const minimum = Math.min(...lows, ...overlayValues), maximum = Math.max(...highs, ...overlayValues);
  const pad = Math.max((maximum - minimum) * .08, Math.abs(maximum) * .0001, .00000001);
  const low = minimum - pad, high = maximum + pad;
  const step = (right - left) / Math.max(rows.length, 1);
  const x = (i: number) => left + (i + .5) * step;
  const y = (price: number) => bottom - (price - low) / (high - low) * (bottom - top);
  const precision = snapshot.price < .01 ? 8 : snapshot.price < 1 ? 5 : 2;
  const priceText = (price: number) => price.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
  const volumeMax = Math.max(1, ...raw.slice(start, end).map(c => c.volume));
  const colors: Record<string, string> = { ema9: "#e0b94f", ema21: "#00d69b", ema50: "#3da3d1", bollinger_upper: "#957acc", bollinger_lower: "#957acc", vwap: "#ddb972" };
  const path = rows.map((c, i) => `${i ? "L" : "M"}${x(i)},${y(c.close)}`).join(" ");
  const hovered = cursor ? Math.min(rows.length - 1, Math.max(0, Math.floor((cursor.x - left) / step))) : -1;
  const selected = rows[hovered];
  const labelStride = Math.max(1, Math.ceil(rows.length / (W < 600 ? 3 : 6)));
  return <div className="chart" ref={container} data-testid="chart" data-interval={snapshot.interval || "1d"} data-style={style} data-last-close={raw.at(-1)?.close} data-last-time={raw.at(-1)?.time}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", touchAction: "none", userSelect: "none", color: "var(--muted, #7d8996)" }} role="img" tabIndex={0} aria-label={`${snapshot.symbol} ${snapshot.interval || "1d"} ${style} chart. Scroll to zoom, drag to pan. Arrow keys pan, plus and minus zoom.`}
      onWheel={event => { event.preventDefault(); setView(v => ({ ...v, count: Math.min(500, Math.max(15, Math.round(v.count * (event.deltaY > 0 ? 1.2 : .8)))) })); }}
      onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "+", "=", "-", "Home"].includes(event.key)) { event.preventDefault(); setView(v => event.key === "Home" ? { count: 100, offset: 0 } : event.key === "ArrowLeft" || event.key === "ArrowRight" ? { ...v, offset: Math.max(0, Math.min(all.length - 15, v.offset + (event.key === "ArrowLeft" ? 10 : -10))) } : { ...v, count: Math.min(500, Math.max(15, Math.round(v.count * (event.key === "-" ? 1.2 : .8)))) }); } }}
      onDoubleClick={() => setView({ count: 100, offset: 0 })}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, offset: view.offset }; }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onPointerLeave={() => setCursor(null)}
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setCursor({ x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H }); if (drag.current) setView(v => ({ ...v, offset: Math.max(0, Math.min(all.length - 15, drag.current!.offset + Math.round((drag.current!.x - event.clientX) / rect.width * v.count))) })); }}>
      <defs><linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#16c995" stopOpacity=".3"/><stop offset="1" stopColor="#16c995" stopOpacity="0"/></linearGradient><clipPath id="plot-clip"><rect x={left} y={top} width={right-left} height={bottom-top}/></clipPath></defs>
      {Array.from({ length: 6 }, (_, i) => { const gy = top + i * (bottom - top) / 5; return <g key={i}><line x1={left} x2={right} y1={gy} y2={gy} stroke="currentColor" opacity=".13"/><text x={right+9} y={gy+4} fill="currentColor" fontSize="11">{priceText(high - i * (high-low)/5)}</text></g>; })}
      {rows.filter((_, i) => i % labelStride === 0 && i > 0).map(c => { const i = rows.indexOf(c); return <g key={c.time}><line x1={x(i)} x2={x(i)} y1={top} y2={H-45} stroke="currentColor" opacity=".1"/><text x={x(i)} y={H-20} textAnchor="middle" fill="currentColor" fontSize="11">{new Date(c.time*1000).toLocaleString(undefined, snapshot.interval === "1d" ? { month: "short", day: "numeric" } : { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</text></g>; })}
      {raw.slice(start,end).map((c,i) => <rect key={c.time} x={x(i)-step*.32} y={H-45-c.volume/volumeMax*60} width={Math.max(.5, step*.64)} height={c.volume/volumeMax*60} fill={c.close>=c.open ? "#16765090" : "#9c3e4890"}/>)}
      <g clipPath="url(#plot-clip)">
        {style === "area" && rows.length > 0 && <path d={`${path} L${x(rows.length-1)},${bottom} L${x(0)},${bottom} Z`} fill="url(#price-fill)"/>}
        {(style === "line" || style === "area") ? <path d={path} fill="none" stroke="#16c995" strokeWidth="1.8"/> : rows.map((c,i) => { const color=c.close>=c.open ? "#16c995" : "#ed6470"; return <g key={c.time} stroke={color} fill={color}><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)}/>{style === "bars" ? <path d={`M${x(i)-step*.3},${y(c.open)} H${x(i)} M${x(i)},${y(c.close)} H${x(i)+step*.3}`} fill="none"/> : <rect x={x(i)-step*.3} y={Math.min(y(c.open),y(c.close))} width={Math.max(.5,step*.6)} height={Math.max(1,Math.abs(y(c.open)-y(c.close)))}/>}</g>; })}
        {indicators.map(key => { const points = new Map((snapshot.indicators.series[key] || []).map(p => [p.time,p.value])); let connected=false; const d=rows.map((c,i) => { const value=points.get(c.time); if(value===undefined || !Number.isFinite(value)) { connected=false; return ""; } const command=connected ? "L" : "M"; connected=true; return `${command}${x(i)},${y(value)}`; }).join(" "); return <path key={key} d={d} stroke={colors[key] || "#7d8996"} fill="none" strokeWidth="1.2"/>; })}
      </g>
      {trades.filter(t => t.symbol === snapshot.symbol).map(t => { const stamp=Date.parse(t.timestamp)/1000; const i=rows.findIndex((c,j) => c.time<=stamp && (!rows[j+1] || rows[j+1].time>stamp)); if(i<0 || stamp>(rows.at(-1)?.time || 0)+86400) return null; return <g key={t.id} role="button" tabIndex={0} aria-label={`${t.action} paper trade`} onClick={() => onTrade(t.decision_id)} onKeyDown={e => { if(e.key === "Enter") onTrade(t.decision_id); }} style={{ cursor:"pointer" }}><circle cx={x(i)} cy={y(rows[i].close)} r="5" fill={t.action === "BUY" ? "#00d69b" : "#ed6470"}/><title>{t.action} PAPER {priceText(t.price)}</title></g>; })}
      {rows.length>0 && <g><line x1={left} x2={right} y1={y(rows.at(-1)!.close)} y2={y(rows.at(-1)!.close)} stroke="#16c995" strokeDasharray="4 4" opacity=".5"/><text x={right+9} y={y(rows.at(-1)!.close)-5} fill="#16c995" fontSize="11">{priceText(rows.at(-1)!.close)}</text></g>}
      {selected && cursor && <g pointerEvents="none"><line x1={x(hovered)} x2={x(hovered)} y1={top} y2={H-45} stroke="currentColor" strokeDasharray="3 4"/><line x1={left} x2={right} y1={cursor.y} y2={cursor.y} stroke="currentColor" strokeDasharray="3 4"/><rect x="12" y="0" width={right-left} height="20" fill="var(--surface, #101721)"/><text x="18" y="14" fill="currentColor" fontSize="11">{new Date(selected.time*1000).toLocaleString()} O {priceText(selected.open)} H {priceText(selected.high)} L {priceText(selected.low)} C {priceText(selected.close)} V {selected.volume.toLocaleString()}</text></g>}
    </svg>
  </div>;
}
