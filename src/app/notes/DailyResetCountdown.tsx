'use client';

import { useEffect, useState } from 'react';

function formatGap(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Ticks down to the next daily top-up. Rendered on the client because a
 * server-rendered duration is stale the moment it reaches the browser -- and
 * because the first paint must not differ between server and client, the
 * countdown only appears after mount.
 */
export default function DailyResetCountdown({
  nextResetAt,
  full,
}: {
  nextResetAt: string | null;
  full: boolean;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!nextResetAt) return;

    const target = new Date(nextResetAt).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => setRemaining(target - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [nextResetAt]);

  if (full) {
    return <p className="text-xs text-ink/45">Topped up — you have the full allowance.</p>;
  }

  if (remaining === null) {
    return <p className="text-xs text-ink/45">Tops back up to 3 every 24 hours.</p>;
  }

  if (remaining <= 0) {
    return (
      <p className="text-xs text-ink/45">
        Top-up is due — reload the page to collect it.
      </p>
    );
  }

  return (
    <p className="text-xs text-ink/45">
      Tops back up to 3 in{' '}
      <span className="font-semibold tabular-nums text-ink/70">{formatGap(remaining)}</span>
    </p>
  );
}
