// Schritt 2 beim Verbinden: TikTok/Instagram schickt dich hierher zurück.
import { NextResponse, type NextRequest } from 'next/server';
import { appUrlFromRequest, callbackUrl } from '@/lib/config';
import { upsertProfile } from '@/lib/sync';
import { errorMessage } from '@/lib/util';
import * as tiktok from '@/lib/platforms/tiktok';
import * as instagram from '@/lib/platforms/instagram';

const OAUTH_COOKIE = 'cd_oauth';

export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const label = platform === 'tiktok' ? 'TikTok' : 'Instagram';

  const done = (query: string) => {
    const res = NextResponse.redirect(new URL(`/manage?${query}`, req.url));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };
  const fail = (msg: string) => done(`error=${encodeURIComponent(msg)}`);

  if (platform !== 'tiktok' && platform !== 'instagram') return fail('Unbekannte Plattform');
  if (sp.get('error')) return fail(`${label}: ${sp.get('error_description') || sp.get('error')}`);

  const code = sp.get('code');
  const state = sp.get('state');
  const [cookiePlatform, cookieChannel, cookieState, cookieVerifier] = (req.cookies.get(OAUTH_COOKIE)?.value ?? '').split('.');
  if (!code) return fail(`${label}: kein Code erhalten`);
  if (!state || cookiePlatform !== platform || cookieState !== state) {
    return fail('Verbindung abgelaufen – bitte nochmal auf „Verbinden“ klicken');
  }

  try {
    const redirectUri = callbackUrl(appUrlFromRequest(req), platform);
    const tokens = platform === 'tiktok' ? await tiktok.exchangeCode(code, redirectUri, cookieVerifier) : await instagram.exchangeCode(code, redirectUri);
    const info = platform === 'tiktok' ? await tiktok.fetchProfile(tokens.accessToken) : await instagram.fetchProfile(tokens.accessToken);
    const id = await upsertProfile(Number(cookieChannel), platform, info, tokens);
    return done(`connected=${id}`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
