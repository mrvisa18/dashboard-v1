'use client';
// Button, der einen oder mehrere Accounts neu lädt (max. 3 gleichzeitig).
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  ids: number[];
  label?: string;
  /** kürzere Beschriftung fürs Handy, z. B. "↻" */
  shortLabel?: string;
  primary?: boolean;
  small?: boolean;
}

export default function SyncButton({ ids, label = 'Aktualisieren', shortLabel, primary, small }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function run() {
    setRunning(true);
    setDone(0);
    setErrors(null);
    const errs: string[] = [];
    let next = 0;
    let finished = 0;
    const worker = async () => {
      while (next < ids.length) {
        const id = ids[next++];
        try {
          const res = await fetch(`/api/sync/${id}`, { method: 'POST' });
          const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
          if (!json.ok) errs.push(json.error ?? 'Unbekannter Fehler');
        } catch (e) {
          errs.push(e instanceof Error ? e.message : String(e));
        }
        setDone(++finished);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
    setRunning(false);
    setErrors(errs);
    router.refresh();
    if (errs.length === 0) setTimeout(() => setErrors(null), 4000);
  }

  let text = label;
  let short = shortLabel ?? label;
  if (running) {
    text = ids.length > 1 ? `Aktualisiere … ${done}/${ids.length}` : 'Aktualisiere …';
    short = ids.length > 1 ? `${done}/${ids.length}` : '…';
  } else if (errors && errors.length > 0) {
    text = `⚠ ${errors.length} Fehler – nochmal`;
    short = `⚠ ${errors.length}`;
  } else if (errors) {
    text = '✓ Aktualisiert';
    short = '✓';
  }

  return (
    <button
      type="button"
      className={`btn${primary ? ' primary' : ''}${small ? ' small' : ''}`}
      onClick={run}
      disabled={running || ids.length === 0}
      title={errors?.length ? errors.join('\n') : undefined}
    >
      <span className={shortLabel ? 'lbl-long' : undefined}>{text}</span>
      {shortLabel && <span className="lbl-short">{short}</span>}
    </button>
  );
}
