export default function SetupNotice() {
  return (
    <main className="wrap">
      <div className="card empty">
        <h2>Fast geschafft – die Datenbank fehlt noch</h2>
        <p>
          Verbinde in Vercel unter <strong>Storage → Create Database → Neon</strong> eine kostenlose Datenbank mit diesem Projekt
          und klicke danach auf <strong>Redeploy</strong>. Die Tabellen legt das Dashboard selbst an.
        </p>
      </div>
    </main>
  );
}
