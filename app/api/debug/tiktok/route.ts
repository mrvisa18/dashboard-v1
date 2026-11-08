// Diagnose: prüft, ob TikTok Client key + Client secret zusammenpassen. Nur eingeloggt erreichbar.
import { NextResponse, type NextRequest } from 'next/server';
import { appUrlFromRequest, callbackUrl } from '@/lib/config';

export async function GET(req: NextRequest) {
  const rawKey = process.env.TIKTOK_CLIENT_KEY ?? '';
  const rawSecret = process.env.TIKTOK_CLIENT_SECRET ?? '';
  const key = rawKey.trim();
  const secret = rawSecret.trim();

  const form = new URLSearchParams({ client_key: key, client_secret: secret, grant_type: 'client_credentials' });
  let tiktok: unknown;
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', body: form, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    tiktok = {
      status: res.status,
      ok: !!body?.access_token,
      error: body?.error ?? null,
      error_description: body?.error_description ?? null,
      log_id: body?.log_id ?? null,
    };
  } catch (e) {
    tiktok = { error: String(e) };
  }

  return NextResponse.json({
    client_key: { length: key.length, start: key.slice(0, 4), hadSpaces: rawKey !== key },
    client_secret: { length: secret.length, hadSpaces: rawSecret !== secret },
    redirect_uri: callbackUrl(appUrlFromRequest(req), 'tiktok'),
    key_secret_check: tiktok,
  });
}
