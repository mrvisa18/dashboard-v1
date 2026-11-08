// Läuft vor jeder Anfrage: Ohne Login sieht niemand dein Dashboard.
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isCronAuthorized, isValidSession } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login', '/privacy', '/terms', '/api/site-verification'];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (/^\/tiktok[A-Za-z0-9_-]+\.txt$/.test(pathname)) return NextResponse.next();
  // App-Icons + Manifest müssen ohne Login ladbar sein (für "Zum Home-Bildschirm")
  if (/^\/(manifest\.webmanifest|icon[\w.-]*\.(png|svg)|apple-icon[\w.-]*\.png)$/.test(pathname)) return NextResponse.next();

  // Täglicher Auto-Sync von Vercel (mit CRON_SECRET)
  if ((pathname === '/api/cron' || pathname.startsWith('/api/sync/')) && isCronAuthorized(req)) {
    return NextResponse.next();
  }

  if (isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Nicht angemeldet' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
