import { PLATFORM_LABEL, type Platform } from '@/lib/config';

export default function Legend({ platforms }: { platforms: Platform[] }) {
  if (platforms.length < 2) return null;
  return (
    <div className="legend">
      {platforms.map((p) => (
        <span key={p}>
          <i className={`sw ${p}`} />
          {PLATFORM_LABEL[p]}
        </span>
      ))}
    </div>
  );
}
