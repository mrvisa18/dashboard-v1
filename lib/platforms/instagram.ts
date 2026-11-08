// Instagram API mit Instagram-Login (Business- oder Creator-Account nötig).
import { ApiError, requestJson } from './http';
import type { FetchResult, ProfileInfo, TokenSet, VideoData } from './types';
import { firstLine, mapPool, num } from '../util';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_HOST = 'https://graph.instagram.com';
const MAX_PAGES = 40; // 40 × 50 = bis zu 2.000 Beiträge
export const SCOPES = 'instagram_business_basic,instagram_business_manage_insights';

function graph(path: string) {
  const v = process.env.INSTAGRAM_GRAPH_VERSION; // optional, z. B. "v24.0"
  return `${GRAPH_HOST}${v ? `/${v}` : ''}${path}`;
}

function creds() {
  const id = process.env.INSTAGRAM_APP_ID;
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!id || !secret) throw new ApiError('INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET fehlen in Vercel');
  return { id, secret };
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    force_reauth: 'true', // zeigt immer den Login → so kannst du nacheinander verschiedene Accounts verbinden
    enable_fb_login: '0',
  });
  return `${AUTHORIZE_URL}?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
  const { id, secret } = creds();
  const form = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const res = await requestJson('Instagram-Login', TOKEN_URL, { method: 'POST', body: form });
  const short = Array.isArray(res?.data) ? res.data[0] : res;
  if (!short?.access_token) throw new ApiError('Instagram hat keinen Zugangs-Token geliefert');

  // Kurzer Token (1 Std.) → langer Token (60 Tage)
  const p = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: secret, access_token: short.access_token });
  const long = await requestJson('Instagram-Token', `${GRAPH_HOST}/access_token?${p}`);
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (num(long.expires_in) ?? 5_184_000) * 1000),
    refreshToken: null,
    refreshExpiresAt: null,
  };
}

/** Verlängert den 60-Tage-Token um weitere 60 Tage. */
export async function refreshToken(accessToken: string): Promise<TokenSet> {
  const p = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken });
  const res = await requestJson('Instagram-Token', `${GRAPH_HOST}/refresh_access_token?${p}`);
  return {
    accessToken: res.access_token,
    expiresAt: new Date(Date.now() + (num(res.expires_in) ?? 5_184_000) * 1000),
    refreshToken: null,
    refreshExpiresAt: null,
  };
}

export async function fetchProfile(token: string): Promise<ProfileInfo> {
  const p = new URLSearchParams({
    fields: 'id,user_id,username,name,profile_picture_url,followers_count',
    access_token: token,
  });
  const me = await requestJson('Instagram', graph(`/me?${p}`));
  const username: string | null = me?.username ?? null;
  return {
    externalId: String(me.user_id ?? me.id),
    username,
    displayName: me?.name || username,
    avatarUrl: me?.profile_picture_url ?? null,
    profileUrl: username ? `https://www.instagram.com/${username}/` : null,
    followers: num(me?.followers_count),
  };
}

/** Alle Beiträge mit Likes & Kommentaren. Views kommen separat über fetchInsights. */
export async function fetchMedia(token: string): Promise<FetchResult> {
  const fields = 'id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count';
  let url: string | null = graph(`/me/media?${new URLSearchParams({ fields, limit: '50', access_token: token })}`);
  const videos: VideoData[] = [];
  let pages = 0;
  let complete = true;

  while (url) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await requestJson('Instagram', url);
    for (const m of data?.data ?? []) {
      videos.push({
        externalId: String(m.id),
        title: firstLine(m.caption),
        thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : m.media_url) ?? null,
        url: m.permalink ?? null,
        publishedAt: m.timestamp ? new Date(m.timestamp) : null,
        durationSec: null,
        views: null,
        likes: num(m.like_count),
        comments: num(m.comments_count),
        shares: null,
        saves: null,
      });
    }
    url = data?.paging?.next ?? null;
    pages++;
    if (url && pages >= MAX_PAGES) {
      complete = false;
      break;
    }
  }
  return { videos, complete };
}

export interface MediaInsights {
  views: number | null;
  shares: number | null;
  saves: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readMetric(data: any[], name: string): number | null {
  const m = data.find((x) => x?.name === name);
  if (!m) return null;
  return num(m.values?.[0]?.value ?? m.total_value?.value);
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

/** Holt Views/Shares/Saves pro Beitrag (1 Anfrage pro Beitrag – deshalb nur für ausgewählte). */
export async function fetchInsights(token: string, mediaIds: string[]): Promise<Map<string, MediaInsights>> {
  const out = new Map<string, MediaInsights>();
  let rateLimited = false;

  async function query(id: string, metrics: string) {
    const p = new URLSearchParams({ metric: metrics, access_token: token });
    const res = await requestJson('Instagram-Insights', graph(`/${id}/insights?${p}`));
    return (res?.data ?? []) as unknown[];
  }

  await mapPool(mediaIds, 8, async (id) => {
    if (rateLimited) return;
    try {
      let data: unknown[];
      try {
        data = await query(id, 'views,shares,saved');
      } catch (e) {
        if (e instanceof ApiError && RATE_LIMIT_CODES.has(Number(e.code))) throw e;
        data = await query(id, 'views'); // manche Beitragstypen kennen shares/saved nicht
      }
      out.set(id, { views: readMetric(data, 'views'), shares: readMetric(data, 'shares'), saves: readMetric(data, 'saved') });
    } catch (e) {
      if (e instanceof ApiError && RATE_LIMIT_CODES.has(Number(e.code))) rateLimited = true;
      // Einzelner Beitrag ohne Insights (z. B. sehr alt) → alten Wert behalten
    }
  });
  return out;
}
