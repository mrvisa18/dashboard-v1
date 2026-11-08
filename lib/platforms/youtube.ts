// YouTube Data API v3 – braucht nur einen API-Schlüssel, kein Login.
import { ApiError, requestJson } from './http';
import type { FetchResult, ProfileInfo, VideoData } from './types';
import { chunk, mapPool, num } from '../util';

const API = 'https://www.googleapis.com/youtube/v3';
const MAX_PAGES = 40; // 40 × 50 = bis zu 2.000 Videos pro Kanal

function apiKey() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new ApiError('YOUTUBE_API_KEY fehlt in Vercel');
  return k;
}

/** Erkennt "@name", "youtube.com/@name", "youtube.com/channel/UC…" oder eine Kanal-ID. */
export function parseChannelInput(input: string): { id?: string; handle?: string } {
  const s = input.trim();
  if (!s) throw new ApiError('Bitte Kanal-Link oder @Handle eingeben');
  if (/^https?:\/\//i.test(s) || /^(www\.|m\.)?youtube\.com\//i.test(s)) {
    const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0]?.startsWith('@')) return { handle: decodeURIComponent(parts[0]) };
    if (parts[0] === 'channel' && parts[1]) return { id: parts[1] };
    throw new ApiError('Link nicht erkannt – nimm den Link mit @Handle (youtube.com/@name)');
  }
  if (/^UC[\w-]{22}$/.test(s)) return { id: s };
  return { handle: s.startsWith('@') ? s : `@${s}` };
}

export async function getChannel(q: { id?: string; handle?: string }): Promise<ProfileInfo> {
  const params = new URLSearchParams({ part: 'snippet,statistics', key: apiKey() });
  if (q.id) params.set('id', q.id);
  else if (q.handle) params.set('forHandle', q.handle);
  const data = await requestJson('YouTube', `${API}/channels?${params}`);
  const ch = data?.items?.[0];
  if (!ch) throw new ApiError('YouTube-Kanal nicht gefunden – stimmt das @Handle?');
  const custom: string | undefined = ch.snippet?.customUrl;
  const handle = custom ? (custom.startsWith('@') ? custom : `@${custom}`) : null;
  return {
    externalId: ch.id,
    username: handle ? handle.slice(1) : null,
    displayName: ch.snippet?.title ?? null,
    avatarUrl: ch.snippet?.thumbnails?.medium?.url ?? ch.snippet?.thumbnails?.default?.url ?? null,
    profileUrl: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${ch.id}`,
    followers: ch.statistics?.hiddenSubscriberCount ? null : num(ch.statistics?.subscriberCount),
  };
}

/** "PT1M5S" → 65 */
export function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export async function fetchVideos(channelId: string): Promise<FetchResult> {
  // Jeder Kanal hat eine "Uploads"-Playlist: UC… → UU…
  const playlistId = `UU${channelId.slice(2)}`;
  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  let complete = true;

  do {
    const p = new URLSearchParams({ part: 'contentDetails', playlistId, maxResults: '50', key: apiKey() });
    if (pageToken) p.set('pageToken', pageToken);
    let data;
    try {
      data = await requestJson('YouTube', `${API}/playlistItems?${p}`);
    } catch (e) {
      // Kanal ohne Uploads hat keine Uploads-Playlist
      if (e instanceof ApiError && e.status === 404 && pages === 0) return { videos: [], complete: true };
      throw e;
    }
    for (const it of data?.items ?? []) {
      if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    }
    pageToken = data?.nextPageToken;
    pages++;
    if (pageToken && pages >= MAX_PAGES) {
      complete = false;
      break;
    }
  } while (pageToken);

  const batches = await mapPool(chunk(ids, 50), 4, async (batch) => {
    const p = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: batch.join(','), key: apiKey() });
    const data = await requestJson('YouTube', `${API}/videos?${p}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.items ?? []) as any[];
  });

  const videos: VideoData[] = batches.flat().map((v) => {
    const duration = parseDuration(v.contentDetails?.duration);
    const isShort = duration !== null && duration <= 180;
    return {
      externalId: v.id,
      title: v.snippet?.title ?? null,
      thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
      url: isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
      publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
      durationSec: duration,
      views: num(v.statistics?.viewCount),
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
      shares: null, // gibt YouTube öffentlich nicht heraus
      saves: null,
    };
  });

  return { videos, complete };
}
