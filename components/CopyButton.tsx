'use client';
import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy">
      <code>{text}</code>
      <button
        type="button"
        className="btn small"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? '✓ Kopiert' : 'Kopieren'}
      </button>
    </span>
  );
}
