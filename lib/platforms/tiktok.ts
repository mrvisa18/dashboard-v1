// TikTok Login Kit + Display API (funktioniert im Sandbox-Modus für bis zu 10 eigene Accounts).
import { createHash } from 'node:crypto';
import { ApiError, requestJson } from './http';
import type { FetchResult, ProfileInfo, TokenSet, VideoData } from './types';
import { firstLine, num } from '../util';

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com/v2';
const MAX_PAGES = 60; // 60 × 20 = bis zu 1.200 Videos pro Account
export const SCOPES = 'user.info.basic,user.info.profile,user.info.stats,video.list';

function creds() {
  // trim(): entfernt versehentlich mitkopierte Leerzeichen/Zeilenumbrüche
  const key = process.env.TIKTOK_CLIENT_KEY?.trim();
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!key || !secret) throw new ApiError('TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET fehlen in Vercel');
  return { key, secret };
}

/** PKCE: TikTok erwartet den SHA256-Hash des Verifiers als Hex-Text. */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('hex');
}

export function authorizeUrl(redirectUri: string, state: string, verifier: string): string {
  const p = new URLSearchParams({
    client_key: creds().key,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: 'S256',
    disable_auto_auth: '1', // Zustimmungsseite immer anzeigen
  });
  return `${AUTHORIZE_URL}?${p}`;
}

/**
 * TikTok akzeptiert nur exakt "application/x-www-form-urlencoded" – ohne ";charset=UTF-8".
 * Deshalb wird der Inhalt als Text mit festem Header geschickt.
 */
function postForm(label: string, form: URLSearchParams) {
  return requestJson(label, `${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTokens(res: any): TokenSet {
  if (!res?.access_token) {
    const msg = res?.error_description || res?.error || 'kein Token erhalten';
    const details = [res?.error, res?.log_id ? `log_id ${res.log_id}` : null].filter(Boolean).join(', ');
    console.error('TikTok token error', JSON.stringify(res));
    throw new ApiError(`TikTok-Login: ${msg}${details ? ` (${details})` : ''}`, undefined, res?.error);
  }
  return {
    accessToken: res.access_token,
    expiresAt: new Date(Date.now() + (num(res.expires_in) ?? 86_400) * 1000),
    refreshToken: res.refresh_token ?? null,
    refreshExpiresAt: res.refresh_expires_in ? new Date(Date.now() + Number(res.refresh_expires_in) * 1000) : null,
  };
}

export async function exchangeCode(code: string, redirectUri: string, verifier?: string): Promise<TokenSet> {
  const { key, secret } = creds();
  const attempt = async (c: string) => {
    const form = new URLSearchParams({
      client_key: key,
      client_secret: secret,
      code: c,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    if (verifier) form.set('code_verifier', verifier);
    return toTokens(await postForm('TikTok-Login', form));
  };
  try {
    return await attempt(code);
  } catch (e) {
    // Falls der Code noch URL-kodiert ankommt (z. B. "%2A"), einmal dekodiert erneut versuchen
    if (code.includes('%')) {
      try {
        return await attempt(decodeURIComponent(code));
      } catch {
        // ursprünglichen Fehler anzeigen
      }
    }
    throw e;
  }
}

/** TikTok-Tokens laufen nach 24 Std. ab und werden mit dem Refresh-Token (1 Jahr) erneuert. */
export async function refreshToken(refresh: string): Promise<TokenSet> {
  const { key, secret } = creds();
  const form = new URLSearchParams({
    client_key: key,
    client_secret: secret,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  });
  return toTokens(await postForm('TikTok-Token', form));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function check(res: any, label: string) {
  const code = res?.error?.code;
  if (code && code !== 'ok') throw new ApiError(`${label}: ${res.error.message || code}`, undefined, code);
  return res;
}

export async function fetchProfile(token: string): Promise<ProfileInfo> {
  const headers = { Authorization: `Bearer ${token}` };
  const fullFields = 'open_id,avatar_url,display_name,username,follower_count';
  let user;
  try {
    user = check(await requestJson('TikTok', `${API}/user/info/?fields=${fullFields}`, { headers }), 'TikTok').data?.user;
  } catch {
    // Falls Scope user.info.profile/stats fehlt: nur Basisdaten
    user = check(await requestJson('TikTok', `${API}/user/info/?fields=open_id,avatar_url,display_name`, { headers }), 'TikTok').data?.user;
  }
  if (!user?.open_id) throw new ApiError('TikTok hat keine Profildaten geliefert');
  const username: string | null = user.username || null;
  return {
    externalId: user.open_id,
    username,
    displayName: user.display_name || username,
    avatarUrl: user.avatar_url ?? null,
    profileUrl: username ? `https://www.tiktok.com/@${username}` : null,
    followers: num(user.follower_count),
  };
}

export async function fetchVideos(token: string): Promise<FetchResult> {
  const fields = 'id,title,video_description,cover_image_url,share_url,create_time,duration,view_count,like_count,comment_count,share_count';
  const videos: VideoData[] = [];
  let cursor: number | undefined;
  let pages = 0;
  let complete = true;

  while (true) {
    const body: Record<string, number> = { max_count: 20 };
    if (cursor) body.cursor = cursor;
    const res = check(
      await requestJson('TikTok', `${API}/video/list/?fields=${fields}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      'TikTok',
    );
    for (const v of res.data?.videos ?? []) {
      videos.push({
        externalId: String(v.id),
        title: firstLine(v.title) ?? firstLine(v.video_description),
        thumbnailUrl: v.cover_image_url ?? null,
        url: v.share_url ?? null,
        publishedAt: v.create_time ? new Date(Number(v.create_time) * 1000) : null,
        durationSec: num(v.duration),
        views: num(v.view_count),
        likes: num(v.like_count),
        comments: num(v.comment_count),
        shares: num(v.share_count),
        saves: null,
      });
    }
    pages++;
    if (!res.data?.has_more || !res.data?.cursor) break;
    if (pages >= MAX_PAGES) {
      complete = false;
      break;
    }
    cursor = Number(res.data.cursor);
  }
  return { videos, complete };
}
