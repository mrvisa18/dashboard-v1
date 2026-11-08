// Aktualisiert alle Accounts. Wird von Vercel (1× täglich) und optional von cron-job.org (z. B. alle 2 Std.) aufgerufen.
// Antwortet sofort und arbeitet danach im Hintergrund weiter – so stört die 30-Sekunden-Grenze von cron-job.org nicht.
import { after, NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isCronAuthorized, isValidSession } from '@/lib/auth';
import { db, ensureSchema } from '@/lib/db';
import { syncProfile } from '@/lib/sync';
import { errorMessage, mapPool } from '@/lib/util';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req) && !isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: 'Nicht erlaubt' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const rows = await db()`SELECT id FROM profiles ORDER BY id`;
    const ids = rows.map((r) => r.id as number);
    const run = () => mapPool(ids, 4, (id) => syncProfile(id));

    // ?wait=1 → wartet aufs Ergebnis (zum Testen im Browser)
    if (req.nextUrl.searchParams.get('wait') === '1') {
      const results = await run();
      return NextResponse.json({ ok: true, synced: results.length, failed: results.filter((r) => !r.ok).length, results });
    }

    after(async () => {
      await run();
    });
    return NextResponse.json({ ok: true, started: ids.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
