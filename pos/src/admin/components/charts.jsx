// Small dependency-free SVG charts for the dashboard: an area sparkline and horizontal bars.
import { useState } from 'react';

const path = (points) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

/**
 * <Sparkline data={[{ label, value }]} format={(v) => …} height={120} />
 * Area chart with hover readout; scales to its container width.
 */
export const Sparkline = ({ data, format = (v) => v, height = 120, color = '#4f46e5', empty = 'No data for this period.' }) => {
  const [hover, setHover] = useState(null);
  const w = 600;
  const h = height;
  const padX = 4;
  const padY = 10;
  if (!data?.length) return <div className="grid h-[120px] place-items-center text-sm text-mist-dim">{empty}</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => [padX + i * step, h - padY - (d.value / max) * (h - padY * 2)]);
  const line = path(pts);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const i = Math.round((x - padX) / (step || 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[var(--h)] w-full" style={{ '--h': `${h}px` }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null ? <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={h} stroke={color} strokeOpacity="0.35" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
        {hover != null ? <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4" fill="#fff" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      {hover != null ? (
        <div className="pointer-events-none absolute -top-1 rounded-md bg-mist px-2 py-1 text-[11px] font-medium text-white shadow-pop" style={{ left: `${(pts[hover][0] / w) * 100}%`, transform: 'translate(-50%, -100%)' }}>
          {data[hover].label}: {format(data[hover].value)}
        </div>
      ) : null}
      <div className="mt-1 flex justify-between text-[10px] text-mist-dim"><span>{data[0].label}</span><span>{data[data.length - 1].label}</span></div>
    </div>
  );
};

/** <Bars data={[{ label, value, sub? }]} format /> horizontal bars, longest first. */
export const Bars = ({ data, format = (v) => v, color = '#4f46e5', empty = 'Nothing sold in this period.' }) => {
  if (!data?.length) return <div className="grid h-24 place-items-center text-sm text-mist-dim">{empty}</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <li key={d.key ?? i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-mist">{d.label}{d.sub ? <span className="ml-1.5 text-mist-dim">{d.sub}</span> : null}</span><span className="shrink-0 tabular-nums text-mist-muted">{format(d.value)}</span></div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
};
