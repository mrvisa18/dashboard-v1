// Macht das Dashboard installierbar ("Zum Home-Bildschirm hinzufügen") – öffnet dann wie eine App.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Clip Dashboard',
    short_name: 'Clips',
    description: 'Alle Clipping-Accounts an einem Ort',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0d0d',
    theme_color: '#0d0d0d',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
