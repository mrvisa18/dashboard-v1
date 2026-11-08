// Verwalten: Kanäle anlegen, Accounts verbinden, Setup prüfen.
import { headers } from 'next/headers';
import AutoSync from '@/components/AutoSync';
import CopyButton from '@/components/CopyButton';
import Header from '@/components/Header';
import SetupNotice from '@/components/SetupNotice';
import SyncButton from '@/components/SyncButton';
import Thumb from '@/components/Thumb';
import { db, ensureSchema, hasDatabase } from '@/lib/db';
import { appUrlFromHost, callbackUrl, PLATFORMS, PLATFORM_LABEL, platformConfigured, type Platform } from '@/lib/config';
import { ago, compact, full } from '@/lib/format';
import { addYoutube, createChannel, deleteChannel, removeProfile, renameChannel } from './actions';

export const dynamic = 'force-dynamic';

interface Channel {
  id: number;
  name: string;
}

interface Profile {
  id: number;
  channel_id: number;
  platform: Platform;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  followers: number | null;
  last_synced_at: Date | null;
  last_error: string | null;
  video_count: number;
}

function Check({ ok, label, wide, children }: { ok: boolean; label: string; wide?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`check${wide ? ' wide' : ''}`}>
      <span className={`check-icon ${ok ? 'ok' : 'missing'}`} aria-hidden="true">
        {ok ? '✓' : '–'}
      </span>
      <div>
        <div>
          {label} <span className="muted">{ok ? '· eingerichtet' : '· fehlt noch'}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function accountName(p: Profile) {
  return p.username ? `@${p.username}` : (p.display_name ?? 'Account');
}

function PlatformRow({ channelId, platform, profiles }: { channelId: number; platform: Platform; profiles: Profile[] }) {
  const configured = platformConfigured(platform);
  const site = platform === 'tiktok' ? 'tiktok.com' : 'instagram.com';
  return (
    <div className="plat-row">
      <div className="plat-name">
        <i className={`pdot ${platform}`} />
        {PLATFORM_LABEL[platform]}
      </div>
      <div className="acc-list">
        {profiles.map((p) => (
          <div className="acc" key={p.id}>
            <Thumb src={p.avatar_url} className="avatar sm" />
            <div className="acc-info">
              <div>
                {p.profile_url ? (
                  <a href={p.profile_url} target="_blank" rel="noreferrer">
                    {accountName(p)}
                  </a>
                ) : (
                  accountName(p)
                )}{' '}
                <span className="muted">
                  · {compact(p.followers)} Follower · {full(p.video_count)} Videos
                </span>
              </div>
              <div className={`status${p.last_error ? ' err' : ''}`}>
                {p.last_error ? `⚠ ${p.last_error}` : `Aktualisiert ${ago(p.last_synced_at)}`}
              </div>
            </div>
            <SyncButton ids={[p.id]} small />
            {platform !== 'youtube' && p.last_error && (
              <a className="btn small" href={`/api/connect/${platform}?channel=${channelId}`}>
                Neu verbinden
              </a>
            )}
            <details className="danger-zone">
              <summary className="btn small">Trennen</summary>
              <form action={removeProfile}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn small danger" type="submit">
                  Ja, trennen &amp; Daten löschen
                </button>
              </form>
            </details>
          </div>
        ))}

        {platform === 'youtube' ? (
          <form action={addYoutube} className="row">
            <input type="hidden" name="channel" value={channelId} />
            <input type="text" name="handle" placeholder="@kanalname oder Kanal-Link" required style={{ width: 260 }} disabled={!configured} />
            <button className="btn small" type="submit" disabled={!configured}>
              {profiles.length ? '+ Weiteren hinzufügen' : 'Hinzufügen'}
            </button>
          </form>
        ) : (
          <div className="row">
            <a className="btn small" href={`/api/connect/${platform}?channel=${channelId}`} aria-disabled={!configured}>
              {profiles.length ? `+ Weiteren ${PLATFORM_LABEL[platform]}-Account` : 'Verbinden'}
            </a>
            {configured && (
              <span className="hint">
                {platform === 'tiktok'
                  ? `Vorher auf ${site} zu genau diesem Account wechseln.`
                  : `Im Login-Fenster mit genau diesem Account anmelden.`}
              </span>
            )}
          </div>
        )}
        {!configured && <span className="hint">Zugangsdaten fehlen noch in Vercel – siehe Anleitung.</span>}
      </div>
    </div>
  );
}

export default async function ManagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!hasDatabase()) return <SetupNotice />;
  const sp = await searchParams;
  await ensureSchema();
  const sql = db();
  const [channels, profiles] = (await Promise.all([
    sql`SELECT id, name FROM channels ORDER BY position, id`,
    sql`
      SELECT p.id, p.channel_id, p.platform, p.username, p.display_name, p.avatar_url, p.profile_url, p.followers,
             p.last_synced_at, p.last_error, (SELECT COUNT(*)::int FROM videos v WHERE v.profile_id = p.id) AS video_count
      FROM profiles p ORDER BY p.id`,
  ])) as unknown as [Channel[], Profile[]];

  const h = await headers();
  const base = appUrlFromHost(h.get('x-forwarded-host') ?? h.get('host'), h.get('x-forwarded-proto'));
  const connected = Number(sp.connected);
  const error = typeof sp.error === 'string' ? sp.error : null;
  const msg = typeof sp.msg === 'string' ? sp.msg : null;

  return (
    <>
      <Header active="manage" profileIds={profiles.map((p) => p.id)} />
      <main className="wrap stack">
        {error && <div className="notice error">⚠ {error}</div>}
        {msg && <div className="notice ok">{msg}</div>}
        {Number.isInteger(connected) && connected > 0 && <AutoSync id={connected} />}

        <section className="card">
          <div className="card-head">
            <h2>Setup-Status</h2>
            <span className="card-sub">Fehlendes trägst du in Vercel unter Settings → Environment Variables ein (danach Redeploy)</span>
          </div>
          <div className="checks">
            <Check ok label="Datenbank" />
            <Check ok={!!process.env.DASHBOARD_PASSWORD} label="Passwort" />
            <Check ok={!!process.env.CRON_SECRET} label="Täglicher Auto-Sync">
              <div className="hint">Variable CRON_SECRET – läuft dann jeden Morgen</div>
            </Check>
            <Check ok={platformConfigured('youtube')} label="YouTube">
              <div className="hint">Variable YOUTUBE_API_KEY</div>
            </Check>
            <Check wide ok={platformConfigured('instagram')} label="Instagram">
              <div className="hint">INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET · Redirect-URL bei Meta eintragen:</div>
              <CopyButton text={callbackUrl(base, 'instagram')} />
            </Check>
            <Check wide ok={platformConfigured('tiktok')} label="TikTok">
              <div className="hint">TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET · Redirect-URL bei TikTok eintragen:</div>
              <CopyButton text={callbackUrl(base, 'tiktok')} />
            </Check>
          </div>
          <details className="table-view">
            <summary>Links für Datenschutz & Nutzungsbedingungen (verlangen TikTok/Meta)</summary>
            <div className="stack" style={{ gap: 4, marginTop: 6 }}>
              <CopyButton text={`${base}/privacy`} />
              <CopyButton text={`${base}/terms`} />
            </div>
          </details>
        </section>

        <div className="section-title" style={{ margin: '12px 0 0' }}>
          <h2>Kanäle</h2>
          <span className="card-sub">Ein Kanal = eine Nische mit ihren Accounts auf TikTok, Instagram und YouTube</span>
        </div>

        {channels.map((ch) => (
          <section className="card channel-card" key={ch.id}>
            <div className="channel-head">
              <form action={renameChannel}>
                <input type="hidden" name="id" value={ch.id} />
                <input type="text" name="name" defaultValue={ch.name} aria-label="Kanalname" required />
                <button className="btn small" type="submit">
                  Umbenennen
                </button>
              </form>
              <div className="spacer" />
              <details className="danger-zone">
                <summary className="btn small danger">Kanal löschen</summary>
                <form action={deleteChannel}>
                  <input type="hidden" name="id" value={ch.id} />
                  <button className="btn small danger" type="submit">
                    Ja, mit allen Accounts löschen
                  </button>
                </form>
              </details>
            </div>
            <div className="plat-rows">
              {PLATFORMS.map((pl) => (
                <PlatformRow
                  key={pl}
                  channelId={ch.id}
                  platform={pl}
                  profiles={profiles.filter((p) => p.channel_id === ch.id && p.platform === pl)}
                />
              ))}
            </div>
          </section>
        ))}

        <section className="card">
          <form action={createChannel} className="row">
            <input type="text" name="name" placeholder={`Name für Kanal ${channels.length + 1}, z. B. „Podcasts“`} required style={{ width: 280 }} />
            <button className="btn primary small" type="submit">
              + Kanal anlegen
            </button>
            {channels.length < 5 && <span className="hint">Du hast {channels.length} von 5 Kanälen angelegt.</span>}
          </form>
        </section>
      </main>
    </>
  );
}
