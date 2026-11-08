/** Wandelt API-Werte ("123", 123, undefined) in eine Zahl oder null um. */
export function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Führt fn für alle Elemente aus – höchstens `limit` gleichzeitig (schont API-Limits). */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Erste Zeile eines Textes, gekürzt – für Videotitel aus Captions. */
export function firstLine(text: string | null | undefined, max = 140): string | null {
  if (!text) return null;
  const line = text.split('\n').find((l) => l.trim() !== '')?.trim() ?? '';
  if (!line) return null;
  return line.length > max ? line.slice(0, max - 1) + '…' : line;
}
