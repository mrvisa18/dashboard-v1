import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Falls TikTok eine Datei zur Domain-Verifizierung verlangt (z. B. /tiktokABC123.txt),
  // wird sie über Umgebungsvariablen ausgeliefert – siehe README.
  async rewrites() {
    return [{ source: '/:file(tiktok[A-Za-z0-9_-]+\\.txt)', destination: '/api/site-verification/:file' }];
  },
};

export default nextConfig;
