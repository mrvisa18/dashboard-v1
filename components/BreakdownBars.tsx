'use client';
// Horizontale Balken: Views pro Kanal (aufgeteilt nach Plattform) bzw. pro Account.
import { useRef, useState } from 'react';
import Legend from './Legend';
import { PLATFORM_LABEL, type Platform } from '@/lib/config';
import { compact, full } from '@/lib/format';

export interface BarRow {
  key: string;
  label: string;
  segments: { platform: Platform; value: number }[];
}

interface Tip {
  x: number;
  y: number;
  label: string;
  platform: Platform;
  value: number;
  total: number;
}

export default function BreakdownBars({ rows, platforms }: { rows: BarRow[]; platforms: Platform[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const totals = rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(1, ...totals);

  function show(el: HTMLElement, clientX: number | null, row: BarRow, seg: BarRow['segments'][number], total: number) {
    const box = ref.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return;
    const x = (clientX ?? r.left + r.width / 2) - box.left;
    setTip({ x, y: r.top - box.top, label: row.label, platform: seg.platform, value: seg.value, total });
  }

  const width = ref.current?.clientWidth ?? 400;

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setTip(null)}>
      <Legend platforms={platforms} />
      <div className="bars">
        {rows.map((row, i) => {
          const total = totals[i];
          return (
            <div className="bar-row" key={row.key}>
              <div className="bar-label" title={row.label}>
                {row.label}
              </div>
              <div className="bar-track">
                <div className="bar" style={{ flex: `0 0 calc((100% - 64px) * ${total / max})` }}>
                  {row.segments
                    .filter((s) => s.value > 0)
                    .map((s) => (
                      <div
                        key={s.platform}
                        className={`seg-fill ${s.platform}`}
                        style={{ flex: `${s.value} 1 0` }}
                        tabIndex={0}
                        aria-label={`${row.label}, ${PLATFORM_LABEL[s.platform]}: ${full(s.value)} Views`}
                        onPointerMove={(e) => show(e.currentTarget, e.clientX, row, s, total)}
                        onFocus={(e) => show(e.currentTarget, null, row, s, total)}
                        onBlur={() => setTip(null)}
                      />
                    ))}
                </div>
                <span className="bar-value">{compact(total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {tip && (
        <div
          className="tooltip"
          style={{ left: Math.max(0, Math.min(tip.x - 80, width - 180)), top: tip.y - 8, transform: 'translateY(-100%)' }}
        >
          <div className="tooltip-title">{tip.label}</div>
          <div className="tooltip-row">
            <i className={`key ${tip.platform}`} />
            <strong>{full(tip.value)}</strong>
            <span className="secondary">{PLATFORM_LABEL[tip.platform]}</span>
          </div>
          <div className="tooltip-row muted">
            <i className="key" />
            <span>Gesamt {full(tip.total)}</span>
          </div>
        </div>
      )}

      <details className="table-view">
        <summary>Als Tabelle anzeigen</summary>
        <table>
          <thead>
            <tr>
              <th />
              {platforms.map((p) => (
                <th key={p} className="n">
                  {PLATFORM_LABEL[p]}
                </th>
              ))}
              <th className="n">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                {platforms.map((p) => (
                  <td key={p} className="n">
                    {full(row.segments.filter((s) => s.platform === p).reduce((a, s) => a + s.value, 0))}
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
