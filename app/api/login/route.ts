import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, expectedSession, passwordMatches } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  let next = String(form.get('next') ?? '/');
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  if (!passwordMatches(password)) {
    const back = new URL('/login', req.url);
    back.searchParams.set('error', '1');
    if (next !== '/') back.searchParams.set('next', next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, expectedSession()!, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
