import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clip Dashboard',
  description: 'Alle Clipping-Accounts an einem Ort',
  robots: { index: false, follow: false },
  // iPhone: als App vom Home-Bildschirm öffnen (ohne Safari-Leiste)
  appleWebApp: { capable: true, title: 'Clips', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
