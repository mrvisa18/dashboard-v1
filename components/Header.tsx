import Link from 'next/link';
import SyncButton from './SyncButton';

export default function Header({ active, profileIds }: { active: 'home' | 'manage'; profileIds: number[] }) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" />
          <span className="brand-text">Clip Dashboard</span>
        </Link>
        <nav className="nav">
          <Link href="/" className={active === 'home' ? 'active' : ''}>
            Übersicht
          </Link>
          <Link href="/manage" className={active === 'manage' ? 'active' : ''}>
            Verwalten
          </Link>
        </nav>
        <div className="spacer" />
        {profileIds.length > 0 && <SyncButton ids={profileIds} label="Alle aktualisieren" shortLabel="↻ Update" primary small />}
        <form action="/api/logout" method="post">
          <button className="btn small" type="submit" aria-label="Abmelden" title="Abmelden">
            <span className="lbl-long">Abmelden</span>
            <span className="lbl-short">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
          </button>
        </form>
      </div>
    </header>
  );
}
