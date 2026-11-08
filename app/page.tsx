// Übersicht: alle Kanäle zusammen oder ein einzelner Kanal/Account.
import Link from 'next/link';
import Header from '@/components/Header';
import BreakdownBars, { type BarRow } from '@/components/BreakdownBars';
import GrowthChart from '@/components/GrowthChart';
import SetupNotice from '@/components/SetupNotice';
import Thumb from '@/components/Thumb';
import { hasDatabase } from '@/lib/db';
import { PLATFORMS, PLATFORM_LABEL, type Platform } from '@/lib/config';
import { ago, compact, date, full, percent } from '@/lib/format';
import { getDashboard, hrefWith, PAGE_SIZE, parseFilters, type Filters, type ProfileStat } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const RANGES = [
  { v: 'all', l: 'Gesamt' },
  { v: '7', l: '7 Tage' },
  { v: '30', l: '30 Tage' },
  { v: '90', l: '90 Tage' },
] as const;

const SORTS = [
  { v: 'new', l: 'Neueste' },
  { v: 'views', l: 'Meiste Views' },
  { v: 'likes', l: 'Meiste Likes' },
  { v: 'engagement', l: 'Engagement' },
] as const;

function handle(p: { username: string | null; display_name: string | null }) {
  return p.username ? `@${p.username}` : (p.display_name ?? 'Unbenannt');
}

function Kpi({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div className={`kpi${hero ? ' hero' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function ProfileCard({ p, f }: { p: ProfileStat; f: Filters }) {
  const selected = f.profile === p.id;
  return (
    <Link href={hrefWith(f, { profile: selected ? null : p.id })} className={`profile${selected ? ' selected' : ''}`}>
      <div className="profile-top">
        <Thumb src={p.avatar_url} className="avatar" />
        <div style={{ minWidth: 0 }}>
          <div className="profile-name">{handle(p)}</div>
          <div className="ptag">
            <i className={`pdot ${p.platform}`} />
            {PLATFORM_LABEL[p.platform]} · {p.channel_name}
          </div>
        </div>
      </div>
      <div className="profile-stats">
        <div>
          <strong>{compact(p.views)}</strong>
          <span>Views</span>
        </div>
        <div>
          <strong>{full(p.video_count)}</strong>
          <span>Videos</span>
        </div>
        <div>
          <strong>{compact(p.followers)}</strong>
          <span>Follower</span>
        </div>
      </div>
      {p.last_error ? (
        <div className="status err" title={p.last_error}>
          ⚠ Fehler beim letzten Sync – Details unter „Verwalten“
        </div>
      ) : (
        <div className="status">Aktualisiert {ago(p.last_synced_at)}</div>
      )}
    </Link>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!hasDatabase()) return <SetupNotice />;
  const f = parseFilters(await searchParams);
  const d = await getDashboard(f);

  if (d.channels.length === 0) {
    return (
      <>
        <Header active="home" profileIds={[]} />
        <main className="wrap">
          <div className="card empty">
            <h2>Willkommen 👋</h2>
            <p>Leg zuerst deine 5 Kanäle an und verbinde die Accounts.</p>
            <Link className="btn primary" href="/manage">
              Zu „Verwalten“
            </Link>
          </div>
        </main>
      </>
    );
  }

  const channelName = f.channel ? d.channels.find((c) => c.id === f.channel)?.name : null;
  const selectedProfile = f.profile ? d.profiles.find((p) => p.id === f.profile) : null;
  const shownPlatforms: Platform[] = f.platform ? [f.platform] : PLATFORMS.filter((p) => d.profiles.some((x) => x.platform === p));
  const rangeText = f.range === 'all' ? 'alle Videos' : `Videos der letzten ${f.range} Tage`;

  const perAccount = !!(f.channel || f.profile);
  const barRows: BarRow[] = perAccount
    ? d.profiles.map((p) => ({ key: String(p.id), label: `${handle(p)} · ${PLATFORM_LABEL[p.platform]}`, segments: [{ platform: p.platform, value: p.views }] }))
    : d.channels.map((c) => ({
        key: String(c.id),
        label: c.name,
        segments: shownPlatforms.map((pl) => ({
          platform: pl,
          value: d.profiles.filter((p) => p.channel_id === c.id && p.platform === pl).reduce((s, p) => s + p.views, 0),
        })),
      }));

  const growthTotal = d.growth.reduce((s, g) => s + shownPlatforms.reduce((a, p) => a + g.values[p], 0), 0);
  const t = d.totals;
  const avg = t.videos ? t.views / t.videos : null;
  const engagement = t.views ? (t.likes + t.comments + t.shares) / t.views : null;
  const pages = Math.max(1, Math.ceil(t.videos / PAGE_SIZE));
  const scopeText = selectedProfile ? handle(selectedProfile) : (channelName ?? 'Alle Kanäle');

  return (
    <>
      <Header active="home" profileIds={d.allProfileIds} />
      <main className="wrap">
        {/* Kanal-Auswahl */}
        <nav className="tabs" aria-label="Kanal">
          <Link className={`tab${!f.channel ? ' active' : ''}`} href={hrefWith(f, { channel: null, profile: null })}>
            Alle Kanäle
          </Link>
          {d.channels.map((c) => (
            <Link key={c.id} className={`tab${f.channel === c.id ? ' active' : ''}`} href={hrefWith(f, { channel: c.id, profile: null })}>
              {c.name}
            </Link>
          ))}
        </nav>

        {/* Filter – gelten für alles darunter */}
        <div className="filters">
          <div className="row">
            <span className="filter-label">Plattform</span>
            <div className="seg">
              <Link className={!f.platform ? 'active' : ''} href={hrefWith(f, { platform: null, profile: null })}>
                Alle
              </Link>
              {PLATFORMS.map((p) => (
                <Link key={p} className={f.platform === p ? 'active' : ''} href={hrefWith(f, { platform: p, profile: null })}>
                  <i className={`pdot ${p}`} />
                  {PLATFORM_LABEL[p]}
                </Link>
              ))}
            </div>
          </div>
          <div className="row">
            <span className="filter-label">Veröffentlicht</span>
            <div className="seg">
              {RANGES.map((r) => (
                <Link key={r.v} className={f.range === r.v ? 'active' : ''} href={hrefWith(f, { range: r.v })}>
                  {r.l}
                </Link>
              ))}
            </div>
          </div>
          {selectedProfile && (
            <span className="chip">
              Nur {handle(selectedProfile)}
              <Link href={hrefWith(f, { profile: null })} aria-label="Filter entfernen">
                ✕
              </Link>
            </span>
          )}
        </div>

        {/* Kennzahlen */}
        <section className="kpis-wrap">
          <Kpi hero label={`Views · ${scopeText}`} value={compact(t.views)} sub={`${full(t.views)} Views · ${rangeText}`} />
          <div className="kpis">
            <Kpi
              label="Views-Zuwachs"
              value={d.hasGrowth ? `+${compact(growthTotal)}` : '–'}
              sub={d.hasGrowth ? `letzte ${d.growthDays} Tage` : 'ab dem 2. Sync-Tag'}
            />
            <Kpi label="Videos" value={full(t.videos)} sub={rangeText} />
            <Kpi label="Ø Views pro Video" value={compact(avg)} />
            <Kpi label="Engagement-Rate" value={percent(engagement)} sub="Interaktionen ÷ Views" />
            <Kpi label="Likes" value={compact(t.likes)} />
            <Kpi label="Kommentare" value={compact(t.comments)} />
            <Kpi label="Shares" value={compact(t.shares)} sub="nur TikTok & Instagram" />
            <Kpi label="Follower" value={compact(t.followers)} sub={`${d.profiles.length} Accounts, aktuell`} />
          </div>
        </section>

        {/* Diagramme */}
        <section className="grid2">
          <div className="card">
            <div className="card-head">
              <h2>{perAccount ? 'Views pro Account' : 'Views pro Kanal'}</h2>
              <span className="card-sub">{rangeText}</span>
            </div>
            {barRows.length ? <BreakdownBars rows={barRows} platforms={shownPlatforms} /> : <div className="empty-chart">Noch keine Accounts verbunden.</div>}
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Täglicher Views-Zuwachs</h2>
              <span className="card-sub">alle Videos · letzte {d.growthDays} Tage</span>
            </div>
            <GrowthChart days={d.growth} platforms={shownPlatforms} hasData={d.hasGrowth} />
          </div>
        </section>

        {/* Accounts */}
        <div className="section-title">
          <h2>Accounts</h2>
          <span className="card-sub">Klick auf einen Account zeigt nur dessen Videos</span>
        </div>
        {d.profiles.length ? (
          <div className="profiles">
            {d.profiles.map((p) => (
              <ProfileCard key={p.id} p={p} f={f} />
            ))}
          </div>
        ) : (
          <div className="card empty">
            <p>
              Keine Accounts für diese Auswahl. <Link href="/manage">Accounts verbinden</Link>
            </p>
          </div>
        )}

        {/* Videos */}
        <section className="card" style={{ marginTop: 28 }}>
          <div className="card-head">
            <h2>Videos</h2>
            <span className="card-sub">
              {full(t.videos)} · {scopeText}
            </span>
            <div className="spacer" />
            <div className="seg sortbar">
              {SORTS.map((s) => (
                <Link key={s.v} className={f.sort === s.v ? 'active' : ''} href={hrefWith(f, { sort: s.v })}>
                  {s.l}
                </Link>
              ))}
            </div>
          </div>
          {d.videos.length ? (
            <div className="table-wrap">
              <table className="videos-table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Veröffentlicht</th>
                    <th className="n">Views</th>
                    <th className="n">Likes</th>
                    <th className="n">Kommentare</th>
                    <th className="n">Shares</th>
                    <th className="n">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {d.videos.map((v) => {
                    const eng = v.views ? ((v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)) / v.views : null;
                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="vid">
                            <Thumb src={v.thumbnail_url} className="thumb" />
                            <div style={{ minWidth: 0 }}>
                              <a className="vid-title" href={v.url ?? '#'} target="_blank" rel="noreferrer">
                                {v.title || 'Ohne Titel'}
                              </a>
                              <div className="vid-meta">
                                <span className="ptag">
                                  <i className={`pdot ${v.platform}`} />
                                  {PLATFORM_LABEL[v.platform]}
                                </span>
                                <span>{handle(v)}</span>
                                {!f.channel && <span>· {v.channel_name}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="num secondary">{date(v.published_at)}</td>
                        <td className="n">
                          <strong>{full(v.views)}</strong>
                        </td>
                        <td className="n">{full(v.likes)}</td>
                        <td className="n">{full(v.comments)}</td>
                        <td className="n">{full(v.shares)}</td>
                        <td className="n">{percent(eng)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Keine Videos für diese Auswahl.</div>
          )}
          {pages > 1 && (
            <div className="pager">
              {f.page > 1 && (
                <Link className="btn small" href={hrefWith(f, { page: f.page - 1 })}>
                  ← Zurück
                </Link>
              )}
              <span className="num">
                Seite {f.page} von {pages}
              </span>
              {f.page < pages && (
                <Link className="btn small" href={hrefWith(f, { page: f.page + 1 })}>
                  Weiter →
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
