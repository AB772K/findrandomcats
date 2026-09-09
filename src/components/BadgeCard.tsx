'use client';

import { useState } from 'react';
import {
  BADGE_RANKS,
  METRIC_LABELS,
  type ProfileBadge,
  type ProfileBadgeHistoryRow,
} from '@/lib/types';

type AnyBadge = ProfileBadge | ProfileBadgeHistoryRow;

const monthLabel = (period: string) =>
  new Date(`${period}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * One badge, as a chip you can open.
 *
 * The chip is deliberately small -- a profile can hold six at once, and six
 * full cards would bury everything else on the page. The card is the reward for
 * tapping.
 */
function Chip({ badge, onOpen }: { badge: AnyBadge; onOpen: () => void }) {
  const rank = BADGE_RANKS[badge.rank] ?? BADGE_RANKS[3];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-2xl border border-blush-100 bg-paper px-3 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-lilac-200 hover:shadow-soft"
    >
      <span aria-hidden className="text-lg leading-none">{rank.medal}</span>
      <span className="min-w-0">
        <span
          className="block font-display text-sm font-semibold"
          style={{ color: rank.color, textShadow: rank.glow }}
        >
          {rank.label}
        </span>
        <span className="block text-[11px] text-ink/50">
          {METRIC_LABELS[badge.metric] ?? badge.metric}
          {'period' in badge ? ` · ${monthLabel(badge.period)}` : ''}
        </span>
      </span>
    </button>
  );
}

/**
 * The inspect view: the badge as a trading card.
 *
 * The tilt follows the pointer rather than being a fixed hover pose, because
 * the thing being imitated is holding a physical card up to the light. It is a
 * CSS transform on a wrapper -- no 3D library, and it costs nothing when
 * nobody is pointing at it.
 *
 * The owner's name sits behind the artwork as a large, faint watermark. That is
 * what makes the card read as belonging to a person rather than being a generic
 * icon: a certificate is only a certificate because it has a name on it.
 */
function InspectCard({
  badge,
  owner,
  onClose,
}: {
  badge: AnyBadge;
  owner: string;
  onClose: () => void;
}) {
  const rank = BADGE_RANKS[badge.rank] ?? BADGE_RANKS[3];
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function follow(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    // -1..1 from the centre, then a shallow angle: past about 12 degrees the
    // text starts to distort more than it reads as depth.
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: -py * 12, y: px * 12 });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${rank.label} on ${METRIC_LABELS[badge.metric] ?? badge.metric}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onPointerMove={follow}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        style={{
          transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 120ms ease-out',
          borderColor: rank.color,
          boxShadow: `0 0 30px ${rank.color}55, 0 20px 45px rgba(0,0,0,.35)`,
        }}
        className="relative w-full max-w-xs overflow-hidden rounded-3xl border-2 bg-ink p-7 text-center"
      >
        {/* The watermark. aria-hidden because the name is already announced in
            the card's own label -- a screen reader should not hear it twice. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 font-display text-4xl font-bold uppercase leading-none tracking-tight text-paper/[0.07]"
        >
          <span className="block break-words">{owner}</span>
        </span>

        <div className="relative space-y-3">
          <div aria-hidden className="text-6xl leading-none">{rank.medal}</div>
          <p
            className="font-display text-3xl font-bold"
            style={{ color: rank.color, textShadow: rank.glow }}
          >
            {rank.label}
          </p>
          <p className="text-sm font-medium text-paper/80">
            {METRIC_LABELS[badge.metric] ?? badge.metric}
          </p>
          <p className="text-xs text-paper/45">
            {'period' in badge
              ? `Held at the close of ${monthLabel(badge.period)}`
              : 'Held right now — until someone takes it'}
          </p>
          <p className="text-xs text-paper/45">
            {Number(badge.score).toLocaleString()} this month
          </p>
          <p className="pt-1 text-[11px] uppercase tracking-widest text-paper/35">{owner}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="relative mt-5 w-full rounded-full border border-paper/25 px-4 py-1.5 text-xs text-paper/70 transition hover:border-paper/50 hover:text-paper"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function BadgeList({
  badges,
  owner,
}: {
  badges: AnyBadge[];
  owner: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (badges.length === 0) return null;

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {badges.map((badge, index) => (
          <li key={`${badge.metric}-${'period' in badge ? badge.period : 'now'}`}>
            <Chip badge={badge} onOpen={() => setOpen(index)} />
          </li>
        ))}
      </ul>
      {open !== null ? (
        <InspectCard badge={badges[open]} owner={owner} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
