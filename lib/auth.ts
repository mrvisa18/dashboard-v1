import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'cd_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage eingeloggt bleiben

function hmac(key: string, msg: string) {
  return createHmac('sha256', key).update(msg).digest();
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Der Cookie-Wert, den ein eingeloggter Browser hat. Ändert sich, wenn du das Passwort änderst. */
export function expectedSession(): string | null {
  const pw = process.env.DASHBOARD_PASSWORD;
  return pw ? hmac(pw, 'clip-dashboard-session-v1').toString('hex') : null;
}

export function isValidSession(value: string | undefined | null): boolean {
  const expected = expectedSession();
  return !!expected && !!value && safeEqual(expected, value);
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  return timingSafeEqual(hmac('compare', input), hmac('compare', pw));
}

/** Vercel schickt beim täglichen Cron automatisch "Authorization: Bearer <CRON_SECRET>". */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`);
}
