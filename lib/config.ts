export type Platform = 'tiktok' | 'instagram' | 'youtube';

export const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function isPlatform(x: unknown): x is Platform {
  return x === 'tiktok' || x === 'instagram' || x === 'youtube';
}

/** Sind die Zugangsdaten für diese Plattform in Vercel eingetragen? */
export function platformConfigured(p: Platform): boolean {
  switch (p) {
    case 'tiktok':
      return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
    case 'instagram':
      return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
    case 'youtube':
      return !!process.env.YOUTUBE_API_KEY;
  }
}

/** Öffentliche Adresse des Dashboards, z. B. https://mein-dashboard.vercel.app */
export function appUrlFromRequest(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');
}

export function appUrlFromHost(host: string | null, proto: string | null): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = host ?? 'localhost:3000';
  const p = proto ?? (h.startsWith('localhost') ? 'http' : 'https');
  return `${p}://${h}`;
}

export function callbackUrl(base: string, p: 'tiktok' | 'instagram') {
  return `${base}/api/callback/${p}`;
}
