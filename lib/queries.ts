// Alle Datenbank-Abfragen für das Dashboard.
import { db, ensureSchema } from './db';
import { isPlatform, PLATFORMS, type Platform } from './config';

export type Range = 'all' | '7' | '30' | '90';
export type Sort = 'new' | 'views' | 'likes' | 'engagement';
export const PAGE_SIZE = 25;

export interface Filters {
  channel: number | null;
  platform: Platform | null;
  profile: number | null;
  range: Range;
  sort: Sort;
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function posInt(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseFilters(sp: SearchParams): Filters {
  const range = one(sp.range);
  const sort = one(sp.sort);
  const platform = one(sp.platform);
  return {
    channel: posInt(one(sp.channel)),
    platform: isPlatform(platform) ? platform : null,
    profile: posInt(one(sp.profile)),
    range: range === '7' || range === '30' || range === '90' ? range : 'all',
    sort: sort === 'views' || sort === 'likes' || sort === 'engagement' ? sort : 'new',
    page: posInt(one(sp.page)) ?? 1,
  };
}

/** Baut einen Link mit geänderten Filtern, z. B. hrefWith(f, { platform: 'tiktok' }) */
export function hrefWith(f: Filters, patch: Partial<Filters>): string {
  const n = { ...f, page: 1, ...patch };
  const q = new URLSearchParams();
  if (n.channel) q.set('channel', String(n.channel));
  if (n.platform) q.set('platform', n.platform);
  if (n.profile) q.set('profile', String(n.profile));
  if (n.range !== 'all') q.set('range', n.range);
  if (n.sort !== 'new') q.set('sort', n.sort);
  if (n.page > 1) q.set('page', String(n.page));
  const s = q.toString();
  return s ? `/?${s}` : '/';
}

export interface ChannelRow {
  id: number;
  name: string;
}

export interface ProfileStat {
  id: number;
  channel_id: number;
  channel_name: string;
  platform: Platform;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  followers: number | null;
  last_synced_at: Date | null;
  last_error: string | null;
  video_count: number;
  views: number;
}

export interface VideoRow {
  id: number;
  title: string | null;
  thumbnail_url: string | null;
  url: string | null;
  published_at: Date | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  platform: Platform;
  username: string | null;
  display_name: string | null;
  channel_name: string;
  profile_id: number;
}

export interface Totals {
  videos: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  followers: number;
}

export interface GrowthDay {
  day: string; // "2026-10-26"
  values: Record<Platform, number>;
}

export interface Dashboard {
  channels: ChannelRow[];
  profiles: ProfileStat[];
  allProfileIds: number[];
  totals: Totals;
  growth: GrowthDay[];
  growthDays: number;
  hasGrowth: boolean;
  videos: VideoRow[];
}

export async function getDashboard(f: Filters): Promise<Dashboard> {
  await ensureSchema();
  const sql = db();

  const profileWhere = sql`
    WHERE TRUE
    ${f.channel ? sql`AND p.channel_id = ${f.channel}` : sql``}
    ${f.platform ? sql`AND p.platform = ${f.platform}` : sql``}
    ${f.profile ? sql`AND p.id = ${f.profile}` : sql``}`;
  const videoRange = f.range === 'all' ? sql`` : sql`AND v.published_at >= now() - ${`${f.range} days`}::interval`;

  const growthDays = f.range === 'all' ? 30 : Number(f.range);

  const order = {
    new: sql`ORDER BY v.published_at DESC NULLS LAST, v.id DESC`,
    views: sql`ORDER BY v.views DESC NULLS LAST, v.id DESC`,
    likes: sql`ORDER BY v.likes DESC NULLS LAST, v.id DESC`,
    engagement: sql`ORDER BY ((COALESCE(v.likes,0) + COALESCE(v.comments,0) + COALESCE(v.shares,0))::float8 / NULLIF(v.views, 0)) DESC NULLS LAST, v.id DESC`,
  }[f.sort];

  const [channels, profiles, allIds, [sums], growthRows, videos] = await Promise.all([
    sql`SELECT id, name FROM channels ORDER BY position, id`,
    sql`
      SELECT p.id, p.channel_id, c.name AS channel_name, p.platform, p.username, p.display_name, p.avatar_url,
             p.profile_url, p.followers, p.last_synced_at, p.last_error,
             COUNT(v.id)::int AS video_count, COALESCE(SUM(v.views), 0)::float8 AS views
      FROM profiles p
      JOIN channels c ON c.id = p.channel_id
      LEFT JOIN videos v ON v.profile_id = p.id ${videoRange}
      ${profileWhere}
      GROUP BY p.id, c.id
      ORDER BY c.position, c.id, array_position(ARRAY['tiktok','instagram','youtube'], p.platform), p.id`,
    sql`SELECT id FROM profiles ORDER BY id`,
    sql`
      SELECT COUNT(*)::int AS videos, COALESCE(SUM(v.views), 0)::float8 AS views, COALESCE(SUM(v.likes), 0)::float8 AS likes,
             COALESCE(SUM(v.comments), 0)::float8 AS comments, COALESCE(SUM(v.shares), 0)::float8 AS shares
      FROM videos v JOIN profiles p ON p.id = v.profile_id
      ${profileWhere} ${videoRange}`,
    sql`
      SELECT t.day::text AS day, t.platform, SUM(GREATEST(t.gain, 0))::float8 AS gain
      FROM (
        SELECT d.day, p.platform, d.views - LAG(d.views) OVER (PARTITION BY d.profile_id ORDER BY d.day) AS gain
        FROM profile_daily d JOIN profiles p ON p.id = d.profile_id
        ${profileWhere}
        AND d.day >= (now() AT TIME ZONE 'Europe/Berlin')::date - ${growthDays}::int
      ) t
      WHERE t.gain IS NOT NULL
      GROUP BY t.day, t.platform`,
    sql`
      SELECT v.id, v.title, v.thumbnail_url, v.url, v.published_at, v.views, v.likes, v.comments, v.shares,
             p.platform, p.username, p.display_name, c.name AS channel_name, p.id AS profile_id
      FROM videos v
      JOIN profiles p ON p.id = v.profile_id
      JOIN channels c ON c.id = p.channel_id
      ${profileWhere} ${videoRange}
      ${order}
      LIMIT ${PAGE_SIZE} OFFSET ${(f.page - 1) * PAGE_SIZE}`,
  ]);

  const profileStats = profiles as unknown as ProfileStat[];

  // Lückenlose Tagesliste (Berliner Zeit), damit Tage ohne Daten als 0 erscheinen
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const growth: GrowthDay[] = [];
  for (let i = growthDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    growth.push({ day, values: Object.fromEntries(PLATFORMS.map((p) => [p, 0])) as Record<Platform, number> });
  }
  const byDay = new Map(growth.map((g) => [g.day, g]));
  for (const r of growthRows) {
    const g = byDay.get(r.day as string);
    if (g && isPlatform(r.platform)) g.values[r.platform] += Number(r.gain);
  }

  return {
    channels: channels as unknown as ChannelRow[],
    profiles: profileStats,
    allProfileIds: allIds.map((r) => r.id as number),
    totals: {
      videos: sums.videos,
      views: sums.views,
      likes: sums.likes,
      comments: sums.comments,
      shares: sums.shares,
      followers: profileStats.reduce((s, p) => s + (p.followers ?? 0), 0),
    },
    growth,
    growthDays,
    hasGrowth: growthRows.length > 0,
    videos: videos as unknown as VideoRow[],
  };
}
