// Schritt 1 beim Verbinden: leitet dich zu TikTok bzw. Instagram weiter.
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { appUrlFromRequest, callbackUrl, platformConfigured } from '@/lib/config';
import * as tiktok from '@/lib/platforms/tiktok';
import * as instagram from '@/lib/platforms/instagram';

const OAUTH_COOKIE = 'cd_oauth';

export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const channel = Number(req.nextUrl.searchParams.get('channel'));
  const fail = (msg: string) => NextResponse.redirect(new URL(`/manage?error=${encodeURIComponent(msg)}`, req.url));

  if (platform !== 'tiktok' && platform !== 'instagram') return fail('Unbekannte Plattform');
  if (!platformConfigured(platform)) return fail(`${platform === 'tiktok' ? 'TikTok' : 'Instagram'} ist noch nicht eingerichtet (Zugangsdaten fehlen in Vercel)`);
  if (!Number.isInteger(channel) || channel <= 0) return fail('Kanal fehlt');

  const state = randomBytes(16).toString('hex');
  const verifier = randomBytes(32).toString('hex'); // für TikTok (PKCE)
  const redirectUri = callbackUrl(appUrlFromRequest(req), platform);
  const target = platform === 'tiktok' ? tiktok.authorizeUrl(redirectUri, state, verifier) : instagram.authorizeUrl(redirectUri, state);

  const res = NextResponse.redirect(target);
  res.cookies.set(OAUTH_COOKIE, `${platform}.${channel}.${state}.${verifier}`, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
