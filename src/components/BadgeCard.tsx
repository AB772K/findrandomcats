'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  METRIC_LABELS,
  periodLabel,
  type ProfileBadge,
  type ProfileBadgeHistoryRow,
} from '@/lib/types';
import type { MedalTier } from '@/components/Medal3D';

type AnyBadge = ProfileBadge | ProfileBadgeHistoryRow;

/**
 * The real medal is a Three.js scene, and Three.js is the heaviest thing in
 * this app by a wide margin. It is loaded on demand, client-only, and only
 * when someone opens a badge to inspect it -- a profile with six badges on it
 * ships six flat thumbnails and no WebGL at all until one is clicked.
 */
const Medal3D = dynamic(() => import('@/components/Medal3D'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex h-[320px] w-[320px] max-w-full items-center justify-center text-xs text-paper/50">
      Casting the medal…
    </div>
  ),
});

/**
 * Three metals for the flat thumbnail: gradients rather than flat colour so
 * the disc reads as material in a list, with a darker rim so it sits INTO the
 * card rather than on top of it. The inspect view replaces this with the real
 * thing.
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

function tierOf(rank: number): MedalTier {
  return rank === 1 || rank === 2 ? rank : 3;
}

function describe(badge: AnyBadge) {
  const when = 'period' in badge ? periodLabel(badge.period) : 'This month';
  const metric = METRIC_LABELS[badge.metric] ?? badge.metric;
  return { when, metric, name: `${metric} — ${when}` };
}

/**
 * The flat thumbnail: a metal disc with the rank, the badge's name beneath.
 * Plain CSS, cheap enough for a list. Clicking it opens the inspect view.
 */
export function BadgeMedal({ badge, owner }: { badge: AnyBadge; owner: string }) {
  const [open, setOpen] = useState(false);
  const metal = METALS[badge.rank] ?? METALS[3];
  const { when, metric, name } = describe(badge);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Inspect ${ORDINAL[badge.rank] ?? badge.rank} place, ${name}`}
        className="group flex w-[132px] flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blush-300"
        style={{
          borderColor: metal.rim,
          background: 'linear-gradient(160deg, #1c1a24 0%, #2a2735 60%, #1a1822 100%)',
          boxShadow: `0 0 14px ${metal.glow}`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 76,
            height: 76,
            background: metal.disc,
            boxShadow: `inset 0 0 0 3px ${metal.rim}, inset 0 -6px 12px rgba(0,0,0,.35), 0 8px 18px rgba(0,0,0,.45)`,
          }}
          className="flex items-center justify-center rounded-full transition group-hover:scale-105"
        >
          <span
            className="font-display text-2xl font-bold"
            style={{ color: metal.ink, textShadow: '0 1px 0 rgba(255,255,255,.45)' }}
          >
            {ORDINAL[badge.rank] ?? badge.rank}
          </span>
        </span>
        <span className="space-y-0.5">
          <span className="block font-display text-xs font-semibold leading-tight text-paper">{metric}</span>
          <span className="block text-[11px] text-paper/60">{when}</span>
        </span>
      </button>
      {open ? <BadgeInspect badge={badge} owner={owner} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * The inspect view: the badge as a real medal, spinning, on a dark ground with
 * its particulars beneath. Escape or the backdrop closes it.
 */
function BadgeInspect({ badge, owner, onClose }: { badge: AnyBadge; owner: string; onClose: () => void }) {
  const metal = METALS[badge.rank] ?? METALS[3];
  const { when, metric, name } = describe(badge);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Into <body>: the profile page animates in with a transform, and a
  // transformed ancestor turns position:fixed into position:relative-to-it,
  // which put the dialog wherever the badge list happened to be.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}, held by ${owner}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        data-badge-inspect
        className="relative w-full max-w-md rounded-3xl border-2 p-5 text-center text-paper shadow-2xl"
        style={{
          borderColor: metal.rim,
          background: 'radial-gradient(circle at 50% 30%, #2f2b3d 0%, #1c1a24 70%)',
          boxShadow: `0 0 40px ${metal.glow}`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/10 text-paper/80 transition hover:bg-white/20"
        >
          ×
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-paper/45">
          {metal.name} · {ORDINAL[badge.rank] ?? badge.rank} place
        </p>
        <Medal3D
          tier={tierOf(badge.rank)}
          rank={badge.rank}
          metric={metric}
          when={when}
          owner={owner}
          name={name}
        />
        <p className="font-display text-lg font-semibold leading-tight">{metric}</p>
        <p className="text-sm text-paper/60">{when}</p>
        <p className="mt-1 text-xs text-paper/45">
          {Number(badge.score).toLocaleString()} {'period' in badge ? 'at the close' : 'so far'} · held by {owner}
        </p>
        <p className="mt-3 text-[11px] text-paper/35">Drag to spin it round. The name is on the back.</p>
      </div>
    </div>,
    document.body,
  );
}

export default function BadgeList({ badges, owner }: { badges: AnyBadge[]; owner: string }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-4">
      {badges.map((badge) => (
        <li key={`${badge.metric}-${'period' in badge ? badge.period : 'now'}`}>
          <BadgeMedal badge={badge} owner={owner} />
        </li>
      ))}
    </ul>
  );
}
