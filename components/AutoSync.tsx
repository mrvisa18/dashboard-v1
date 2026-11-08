'use client';
// Lädt direkt nach dem Verbinden eines Accounts alle Videos.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AutoSync({ id }: { id: number }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let query: string;
      try {
        const res = await fetch(`/api/sync/${id}`, { method: 'POST' });
        const json = await res.json();
        query = json.ok
          ? `msg=${encodeURIComponent(`Verbunden ✓ – ${json.videos} Videos geladen`)}`
          : `error=${encodeURIComponent(`Verbunden, aber Laden fehlgeschlagen: ${json.error}`)}`;
      } catch (e) {
        query = `error=${encodeURIComponent(`Verbunden, aber Laden fehlgeschlagen: ${e instanceof Error ? e.message : e}`)}`;
      }
      router.replace(`/manage?${query}`);
    })();
  }, [id, router]);

  return <div className="notice">Verbunden ✓ – lade jetzt alle Videos … (kann bis zu 1 Minute dauern, Seite offen lassen)</div>;
}
