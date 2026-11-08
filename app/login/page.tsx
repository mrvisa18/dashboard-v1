export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/';
  const configured = !!process.env.DASHBOARD_PASSWORD;

  return (
    <main className="login">
      <form className="card" method="post" action="/api/login">
        <div className="brand">
          <span className="brand-mark" />
          Clip Dashboard
        </div>
        {!configured && (
          <div className="notice error">
            Noch kein Passwort gesetzt: Trag in Vercel die Variable <code>DASHBOARD_PASSWORD</code> ein und klicke auf Redeploy.
          </div>
        )}
        {sp.error && <div className="notice error">Falsches Passwort.</div>}
        <input type="password" name="password" placeholder="Passwort" autoFocus required aria-label="Passwort" />
        <input type="hidden" name="next" value={next} />
        <button className="btn primary" type="submit">
          Anmelden
        </button>
      </form>
    </main>
  );
}
