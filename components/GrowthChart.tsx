'use client';
// Säulen: Wie viele Views pro Tag dazugekommen sind (gestapelt nach Plattform).
import { useEffect, useRef, useState } from 'react';
import Legend from './Legend';
import { PLATFORM_LABEL, type Platform } from '@/lib/config';
import { compact, dayLong, dayShort, full } from '@/lib/format';
import type { GrowthDay } from '@/lib/queries';

const H = 220;
const M = { l: 44, r: 6, t: 10, b: 24 };

/** Runde Achsenwerte: 0 / 2,5K / 5K / 7,5K … */
function niceScale(maxValue: number) {
  const raw = maxValue / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const max = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);
  return { max, ticks };
}

/** Rechteck mit oben abgerundeten Ecken, unten eckig (auf der Grundlinie). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export default function GrowthChart({ days, platforms, hasData }: { days: GrowthDay[]; platforms: Platform[]; hasData: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!hasData) {
    return (
      <div className="empty-chart">
        Der tägliche Zuwachs erscheint ab dem zweiten Tag – das Dashboard speichert jeden Tag einen Stand und vergleicht ihn mit dem Vortag.
      </div>
    );
  }

  const totals = days.map((d) => platforms.reduce((s, p) => s + d.values[p], 0));
  const { max, ticks } = niceScale(Math.max(...totals, 1));
  const pw = width - M.l - M.r;
  const ph = H - M.t - M.b;
  const band = pw / days.length;
  const bw = Math.max(2, Math.min(24, band * 0.62));
  const y = (v: number) => M.t + ph - (v / max) * ph;
  const labelEvery = Math.ceil(days.length / 6);

  const hovered = hover !== null ? days[hover] : null;
  // Tooltip neben die Säule setzen (nicht darüber), damit die Säule sichtbar bleibt
  const TIP_W = 180;
  const colX = hover !== null ? M.l + hover * band : 0;
  const tipLeft =
    hover === null ? 0 : colX + band / 2 > width / 2 ? Math.max(0, colX - TIP_W - 6) : Math.min(width - TIP_W, colX + band + 6);

  return (
    <div className="chart" ref={ref}>
      <Legend platforms={platforms} />
      <svg
        className="plot"
        width={width}
        height={H}
        role="img"
        aria-label="Täglicher Views-Zuwachs"
        tabIndex={0}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? days.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? days.length) - 1));
          if (e.key === 'ArrowRight') setHover((h) => Math.min(days.length - 1, (h ?? -1) + 1));
        }}
      >
        {/* Hilfslinien + Achse */}
        {ticks.map((t) => (
          <g key={t}>
            {t > 0 && <line className="s-grid" x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} strokeWidth={1} />}
            <text className="t-axis" x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}

        {hover !== null && <rect className="f-hover" x={M.l + hover * band} y={M.t} width={band} height={ph} rx={3} />}

        {/* Säulen */}
        {days.map((d, i) => {
          const x = M.l + i * band + (band - bw) / 2;
          const segs = platforms.filter((p) => d.values[p] > 0);
          let acc = 0;
          return (
            <g key={d.day}>
              {segs.map((p, k) => {
                const v = d.values[p];
                const bottom = y(acc) - (k > 0 ? 2 : 0); // 2px Lücke zwischen Segmenten
                acc += v;
                const top = y(acc);
                const h = bottom - top;
                if (h < 0.5) return null;
                return k === segs.length - 1 ? (
                  <path key={p} className={`f-${p}`} d={topRounded(x, top, bw, h, 4)} />
                ) : (
                  <rect key={p} className={`f-${p}`} x={x} y={top} width={bw} height={h} />
                );
              })}
            </g>
          );
        })}

        <line className="s-axis" x1={M.l} x2={width - M.r} y1={y(0)} y2={y(0)} strokeWidth={1} />

        {days.map((d, i) =>
          (days.length - 1 - i) % labelEvery === 0 ? (
            <text key={d.day} className="t-axis" x={M.l + i * band + band / 2} y={H - 6} textAnchor="middle">
              {dayShort(d.day)}
            </text>
          ) : null,
        )}

        {/* Unsichtbare Hover-Flächen (breiter als die Säule) */}
        {days.map((d, i) => (
          <rect key={d.day} x={M.l + i * band} y={M.t} width={band} height={ph} fill="transparent" onPointerEnter={() => setHover(i)} />
        ))}
      </svg>

      {hovered && hover !== null && (
        <div className="tooltip" style={{ left: tipLeft, top: M.t + 28, width: TIP_W }}>
          <div className="tooltip-title">{dayLong(hovered.day)}</div>
          <div className="tooltip-row">
            <i className="key" />
            <strong>+{full(totals[hover])}</strong>
            <span className="secondary">Gesamt</span>
          </div>
          {platforms.length > 1 &&
            platforms.map((p) => (
              <div className="tooltip-row" key={p}>
                <i className={`key ${p}`} />
                <strong>+{full(hovered.values[p])}</strong>
                <span className="secondary">{PLATFORM_LABEL[p]}</span>
              </div>
            ))}
        </div>
      )}

      <details className="table-view">
        <summary>Als Tabelle anzeigen</summary>
        <table>
          <thead>
            <tr>
              <th>Tag</th>
              {platforms.map((p) => (
                <th key={p} className="n">
                  {PLATFORM_LABEL[p]}
                </th>
              ))}
              <th className="n">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.day}>
                <td>{dayLong(d.day)}</td>
                {platforms.map((p) => (
                  <td key={p} className="n">
                    {full(d.values[p])}
                  </td>
                ))}
                <td className="n">{full(totals[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
