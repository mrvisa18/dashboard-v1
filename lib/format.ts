// Zahlen & Daten so formatieren, wie man es von TikTok/Instagram kennt: 12,3K · 1,2 Mio.

function short(v: number, suffix: string) {
  const digits = Math.abs(v) >= 100 ? 0 : 1;
  return v.toLocaleString('de-DE', { maximumFractionDigits: digits }) + suffix;
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e9) return short(n / 1e9, ' Mrd.');
  if (a >= 999_950) return short(n / 1e6, ' Mio.');
  if (a >= 10_000) return short(n / 1e3, 'K');
  return Math.round(n).toLocaleString('de-DE');
}

export function full(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return Math.round(n).toLocaleString('de-DE');
}

export function percent(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–';
  return (x * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

/** "2026-10-26" → "26.10." */
export function dayShort(isoDay: string): string {
  const [, m, d] = isoDay.split('-');
  return `${d}.${m}.`;
}

export function dayLong(isoDay: string): string {
  const [y, m, d] = isoDay.split('-');
  return `${d}.${m}.${y}`;
}

export function ago(d: Date | string | null | undefined): string {
  if (!d) return 'noch nie';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  const days = Math.round(s / 86400);
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}
