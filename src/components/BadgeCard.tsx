'use client';

import Card3D from '@/components/Card3D';
import {
  METRIC_LABELS,
  periodLabel,
  type ProfileBadge,
  type ProfileBadgeHistoryRow,
} from '@/lib/types';

type AnyBadge = ProfileBadge | ProfileBadgeHistoryRow;

/**
 * Three metals, built from gradients rather than flat colour so they read as
 * material: a hard diagonal band for the sheen, a soft radial for the dome,
 * and a darker rim so the disc sits INTO the card rather than on top of it.
 */
const METALS: Record<number, { name: string; disc: string; rim: string; ink: string; glow: string }> = {
  1: {
    name: 'Gold',
    disc: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.65) 0%, rgba(255,255,255,0) 38%), linear-gradient(135deg, #fff3b0 0%, #f5c542 28%, #c98f1c 52%, #f7d774 74%, #8c5e0a 100%)',
    rim: '#7a4f05',
    ink: '#5a3a02',
    glow: 'rgba(255,207,61,.55)',
  },
  2: {
    name: 'Silver',
    disc: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 38%), linear-gradient(135deg, #ffffff 0%, #d9dee6 28%, #8d96a3 52%, #e8ecf1 74%, #5f6873 100%)',
    rim: '#4b525b',
    ink: '#2f353c',
    glow: 'rgba(215,222,232,.5)',
  },
  3: {
    name: 'Bronze',
    disc: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 38%), linear-gradient(135deg, #ffd9b8 0%, #d9884f 28%, #8a4d22 52%, #e6a170 74%, #5a2f10 100%)',
    rim: '#4a260d',
    ink: '#3d1f0a',
    glow: 'rgba(224,160,106,.5)',
  },
};
const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

/**
 * One Badge as a card: a metal disc for the rank on the front with the badge's
 * full name -- metric and month -- written out beneath it, and the holder's
 * name engraved on the back.
 *
 * The engraving is two offset text-shadows, light above and dark below, on a
 * low-contrast fill: the letters read as pressed into the metal rather than
 * printed on it. That is the trading-card cue -- a name on the back is what
 * makes it this person's badge rather than a generic one.
 */
export function BadgeMedal({ badge, owner, size = 'md' }: { badge: AnyBadge; owner: string; size?: 'sm' | 'md' }) {
  const metal = METALS[badge.rank] ?? METALS[3];
  const when = 'period' in badge ? periodLabel(badge.period) : 'This month';
  const metric = METRIC_LABELS[badge.metric] ?? badge.metric;
  const name = `${when} — ${metric}`;
  const w = size === 'sm' ? 150 : 190;
  const h = size === 'sm' ? 200 : 250;
  const disc = size === 'sm' ? 84 : 108;

  const face = 'absolute inset-0 rounded-2xl border-2 overflow-hidden';
  const faceStyle = {
    borderColor: metal.rim,
    background: `linear-gradient(160deg, #1c1a24 0%, #2a2735 60%, #1a1822 100%)`,
  };

  return (
    <Card3D
      width={w}
      height={h}
      glow={metal.glow}
      label={`${ORDINAL[badge.rank] ?? badge.rank} place, ${name}, held by ${owner}`}
      front={
        <div className={face} style={faceStyle}>
          <div className="flex h-full flex-col items-center justify-between p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-paper/45">
              {metal.name}
            </p>
            <div
              aria-hidden
              style={{
                width: disc,
                height: disc,
                background: metal.disc,
                boxShadow: `inset 0 0 0 3px ${metal.rim}, inset 0 -6px 12px rgba(0,0,0,.35), 0 8px 18px rgba(0,0,0,.45)`,
              }}
              className="flex items-center justify-center rounded-full"
            >
              <span
                className="font-display text-3xl font-bold"
                style={{ color: metal.ink, textShadow: '0 1px 0 rgba(255,255,255,.45)' }}
              >
                {ORDINAL[badge.rank] ?? badge.rank}
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="font-display text-sm font-semibold leading-tight text-paper">{metric}</p>
              <p className="text-[11px] text-paper/60">{when}</p>
              <p className="text-[10px] text-paper/40">
                {Number(badge.score).toLocaleString()} {'period' in badge ? 'at the close' : 'so far'}
              </p>
            </div>
          </div>
        </div>
      }
      back={
        <div className={face} style={faceStyle}>
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[.2em] text-paper/35">Held by</p>
            <p
              className="break-words font-display text-xl font-bold uppercase tracking-wide"
              style={{
                color: 'rgba(255,255,255,.22)',
                textShadow: '0 1px 0 rgba(255,255,255,.28), 0 -1px 0 rgba(0,0,0,.6)',
              }}
            >
              {owner}
            </p>
            <p className="mt-2 text-[10px] text-paper/35">{name}</p>
          </div>
        </div>
      }
    />
  );
}

export default function BadgeList({ badges, owner }: { badges: AnyBadge[]; owner: string }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-4">
      {badges.map((badge) => (
        <li key={`${badge.metric}-${'period' in badge ? badge.period : 'now'}`}>
          <BadgeMedal badge={badge} owner={owner} size="sm" />
        </li>
      ))}
    </ul>
  );
}
