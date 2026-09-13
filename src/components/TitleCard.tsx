'use client';

import Card3D from '@/components/Card3D';
import { TIER_LABELS, TIER_NEON, periodLabel } from '@/lib/types';

/**
 * A Title as a card: the name in its tier's neon, the month it was earned,
 * and "Awarded to {name}" on the face.
 *
 * No back. A badge needs one because its front is a metal disc and the owner
 * has to go somewhere; a Title's front already states who it belongs to, so a
 * back would be parity for its own sake. Card3D simply does not flip when no
 * back is given, and the card announces itself as an image rather than a
 * button.
 */
export default function TitleCard({
  title,
  tier,
  label,
  period,
  owner,
  size = 'md',
  selected = false,
}: {
  title: string;
  tier: 1 | 2 | 3;
  /** Human name for the category, e.g. "Hearts". */
  label: string;
  /** First-of-month it was earned, or null for a legacy row. */
  period: string | null;
  owner: string;
  size?: 'sm' | 'md';
  /** Ring the card when it is the one on display, for the settings picker. */
  selected?: boolean;
}) {
  const neon = TIER_NEON[tier];
  const when = period ? periodLabel(period) : null;
  const w = size === 'sm' ? 150 : 190;
  const h = size === 'sm' ? 200 : 250;

  return (
    <Card3D
      width={w}
      height={h}
      glow={selected ? neon.color : `${neon.color}66`}
      label={`${when ? when + ' — ' : ''}${title}, ${TIER_LABELS[tier]} ${label}, awarded to ${owner}`}
      front={
        <div
          className="absolute inset-0 overflow-hidden rounded-2xl border-2"
          style={{
            borderColor: selected ? neon.color : `${neon.color}88`,
            background: 'linear-gradient(160deg, #1c1a24 0%, #2a2735 60%, #1a1822 100%)',
          }}
        >
          {/* A faint band of the tier colour across the top, so a row of cards
              reads as tiers at a glance before the text is read. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: neon.color, boxShadow: neon.glow }}
          />
          <div className="flex h-full flex-col items-center justify-between p-4 pt-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-paper/45">
              {TIER_LABELS[tier]} · {label}
            </p>
            <div className="space-y-1">
              {when ? <p className="text-[11px] text-paper/55">{when}</p> : null}
              <p
                className={`font-display font-bold leading-tight ${size === 'sm' ? 'text-xl' : 'text-2xl'}`}
                style={{ color: neon.color, textShadow: neon.glow }}
              >
                {title}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-[.2em] text-paper/35">Awarded to</p>
              <p className="break-words font-display text-sm font-semibold text-paper/85">{owner}</p>
            </div>
          </div>
        </div>
      }
    />
  );
}
