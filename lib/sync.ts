// Holt für einen Account alle Videos + Statistiken und speichert sie in der Datenbank.
import { db, ensureSchema } from './db';
import type { Platform } from './config';
import { chunk, errorMessage } from './util';
import type { FetchResult, ProfileInfo, TokenSet } from './platforms/types';
import * as youtube from './platforms/youtube';
import * as instagram from './platforms/instagram';
import * as tiktok from './platforms/tiktok';

// Instagram liefert Views nur einzeln pro Beitrag → pro Sync die neuesten 150
// plus bis zu 150 ältere, die noch gar keine Views haben.
const IG_NEWEST = 150;
const IG_BACKFILL = 150;

interface ProfileRow {
  id: number;
  channel_id: number;
  platform: Platform;
  external_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
}

export interface SyncResult {
  id: number;
  ok: boolean;
  videos?: number;
  error?: string;
}

/** Legt einen Account an oder aktualisiert ihn (z. B. nach erneutem Verbinden). Gibt die ID zurück. */
export async function upsertProfile(channelId: number, platform: Platform, info: ProfileInfo, tokens?: TokenSet): Promise<number> {
  await ensureSchema();
  const sql = db();
  const [row] = await sql`
    INSERT INTO profiles (channel_id, platform, external_id, username, display_name, avatar_url, profile_url, followers,
                          access_token, refresh_token, token_expires_at, refresh_expires_at)
    VALUES (${channelId}, ${platform}, ${info.externalId}, ${info.username}, ${info.displayName}, ${info.avatarUrl},
            ${info.profileUrl}, ${info.followers}, ${tokens?.accessToken ?? null}, ${tokens?.refreshToken ?? null},
            ${tokens?.expiresAt ?? null}, ${tokens?.refreshExpiresAt ?? null})
    ON CONFLICT (platform, external_id) DO UPDATE SET
      channel_id         = EXCLUDED.channel_id,
      username           = COALESCE(EXCLUDED.username, profiles.username),
      display_name       = COALESCE(EXCLUDED.display_name, profiles.display_name),
      avatar_url         = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      profile_url        = COALESCE(EXCLUDED.profile_url, profiles.profile_url),
      followers          = COALESCE(EXCLUDED.followers, profiles.followers),
      access_token       = COALESCE(EXCLUDED.access_token, profiles.access_token),
      refresh_token      = COALESCE(EXCLUDED.refresh_token, profiles.refresh_token),
      token_expires_at   = COALESCE(EXCLUDED.token_expires_at, profiles.token_expires_at),
      refresh_expires_at = COALESCE(EXCLUDED.refresh_expires_at, profiles.refresh_expires_at),
      last_error         = NULL
    RETURNING id`;
  return row.id as number;
}

async function tiktokToken(p: ProfileRow): Promise<string> {
  const exp = p.token_expires_at ? new Date(p.token_expires_at).getTime() : 0;
  if (p.access_token && exp > Date.now() + 5 * 60_000) return p.access_token;
  if (!p.refresh_token) throw new Error('TikTok-Verbindung abgelaufen – bitte unter „Verwalten“ neu verbinden');
  let t: TokenSet;
  try {
    t = await tiktok.refreshToken(p.refresh_token);
  } catch (e) {
    throw new Error(`TikTok-Verbindung abgelaufen – bitte neu verbinden (${errorMessage(e)})`);
  }
  await db()`
    UPDATE profiles SET access_token = ${t.accessToken}, refresh_token = ${t.refreshToken ?? p.refresh_token},
      token_expires_at = ${t.expiresAt}, refresh_expires_at = COALESCE(${t.refreshExpiresAt}, refresh_expires_at)
    WHERE id = ${p.id}`;
  return t.accessToken;
}

async function instagramToken(p: ProfileRow): Promise<string> {
  if (!p.access_token) throw new Error('Instagram nicht verbunden – bitte neu verbinden');
  const exp = p.token_expires_at ? new Date(p.token_expires_at).getTime() : 0;
  if (exp && exp < Date.now()) throw new Error('Instagram-Verbindung abgelaufen – bitte unter „Verwalten“ neu verbinden');
  // Token rechtzeitig verlängern (gültig 60 Tage, wir verlängern ab 15 Tagen Alter)
  if (exp && exp - Date.now() < 45 * 86_400_000) {
    try {
      const t = await instagram.refreshToken(p.access_token);
      await db()`UPDATE profiles SET access_token = ${t.accessToken}, token_expires_at = ${t.expiresAt} WHERE id = ${p.id}`;
      return t.accessToken;
    } catch {
      // z. B. Token jünger als 24 Std. – alter Token ist noch gültig
    }
  }
  return p.access_token;
}

async function instagramMedia(profileId: number, token: string): Promise<FetchResult> {
  const result = await instagram.fetchMedia(token);
  const existing = await db()`SELECT external_id, views FROM videos WHERE profile_id = ${profileId}`;
  const knownViews = new Map<string, number | null>(existing.map((r) => [r.external_id as string, r.views as number | null]));

  const newestFirst = [...result.videos].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const ids = [
    ...newestFirst.slice(0, IG_NEWEST).map((v) => v.externalId),
    ...newestFirst
      .slice(IG_NEWEST)
      .filter((v) => knownViews.get(v.externalId) == null)
      .slice(0, IG_BACKFILL)
      .map((v) => v.externalId),
  ];
  const insights = await instagram.fetchInsights(token, ids);
  for (const v of result.videos) {
    const i = insights.get(v.externalId);
    if (i) {
      v.views = i.views;
      v.shares = i.shares;
      v.saves = i.saves;
    }
  }
  return result;
}

async function saveVideos(profileId: number, result: FetchResult) {
  const sql = db();
  const rows = result.videos.map((v) => ({
    profile_id: profileId,
    external_id: v.externalId,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    url: v.url,
    published_at: v.publishedAt,
    duration_sec: v.durationSec,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
    saves: v.saves,
  }));

  for (const part of chunk(rows, 300)) {
    await sql`
      INSERT INTO videos ${sql(part)}
      ON CONFLICT (profile_id, external_id) DO UPDATE SET
        title            = EXCLUDED.title,
        thumbnail_url    = COALESCE(EXCLUDED.thumbnail_url, videos.thumbnail_url),
        url              = COALESCE(EXCLUDED.url, videos.url),
        published_at     = COALESCE(EXCLUDED.published_at, videos.published_at),
        duration_sec     = COALESCE(EXCLUDED.duration_sec, videos.duration_sec),
        views            = COALESCE(EXCLUDED.views, videos.views),
        likes            = COALESCE(EXCLUDED.likes, videos.likes),
        comments         = COALESCE(EXCLUDED.comments, videos.comments),
        shares           = COALESCE(EXCLUDED.shares, videos.shares),
        saves            = COALESCE(EXCLUDED.saves, videos.saves),
        stats_updated_at = CASE WHEN EXCLUDED.views IS NOT NULL THEN now() ELSE videos.stats_updated_at END`;
  }
  await sql`UPDATE videos SET stats_updated_at = now() WHERE profile_id = ${profileId} AND stats_updated_at IS NULL AND views IS NOT NULL`;

  // Gelöschte Videos entfernen – nur wenn wir sicher die komplette Liste haben
  if (result.complete && rows.length > 0) {
    await sql`DELETE FROM videos WHERE profile_id = ${profileId} AND external_id NOT IN ${sql(rows.map((r) => r.external_id))}`;
  }
}

/** Speichert den heutigen Stand (für das "Täglicher Zuwachs"-Diagramm). */
async function saveSnapshot(profileId: number, followers: number | null) {
  await db()`
    INSERT INTO profile_daily (profile_id, day, views, likes, comments, shares, followers, videos)
    SELECT ${profileId}::int, (now() AT TIME ZONE 'Europe/Berlin')::date,
           COALESCE(SUM(views), 0), COALESCE(SUM(likes), 0), COALESCE(SUM(comments), 0), COALESCE(SUM(shares), 0),
           ${followers}::bigint, COUNT(*)
    FROM videos WHERE profile_id = ${profileId}
    ON CONFLICT (profile_id, day) DO UPDATE SET
      views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
      shares = EXCLUDED.shares, followers = EXCLUDED.followers, videos = EXCLUDED.videos`;
}

export async function syncProfile(profileId: number): Promise<SyncResult> {
  await ensureSchema();
  const sql = db();
  const [p] = (await sql`SELECT * FROM profiles WHERE id = ${profileId}`) as unknown as ProfileRow[];
  if (!p) return { id: profileId, ok: false, error: 'Account nicht gefunden' };

  try {
    let info: ProfileInfo;
    let result: FetchResult;
    if (p.platform === 'youtube') {
      info = await youtube.getChannel({ id: p.external_id });
      result = await youtube.fetchVideos(p.external_id);
    } else if (p.platform === 'instagram') {
      const token = await instagramToken(p);
      info = await instagram.fetchProfile(token);
      result = await instagramMedia(p.id, token);
    } else {
      const token = await tiktokToken(p);
      info = await tiktok.fetchProfile(token);
      result = await tiktok.fetchVideos(token);
    }

    await saveVideos(p.id, result);
    await sql`
      UPDATE profiles SET
        username = COALESCE(${info.username}, username),
        display_name = COALESCE(${info.displayName}, display_name),
        avatar_url = COALESCE(${info.avatarUrl}, avatar_url),
        profile_url = COALESCE(${info.profileUrl}, profile_url),
        followers = COALESCE(${info.followers}::bigint, followers),
        last_synced_at = now(),
        last_error = NULL
      WHERE id = ${p.id}`;
    await saveSnapshot(p.id, info.followers);
    return { id: p.id, ok: true, videos: result.videos.length };
  } catch (e) {
    const msg = errorMessage(e).slice(0, 500);
    await sql`UPDATE profiles SET last_error = ${msg} WHERE id = ${p.id}`;
    return { id: p.id, ok: false, error: msg };
  }
}
