'use client';
// Vorschaubild mit Ersatz, falls der Link abgelaufen ist (TikTok/Instagram-Bilder verfallen nach einiger Zeit).
import { useState } from 'react';

export default function Thumb({ src, alt = '', className }: { src: string | null; alt?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={className} aria-hidden="true">
        ▶
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  );
}
