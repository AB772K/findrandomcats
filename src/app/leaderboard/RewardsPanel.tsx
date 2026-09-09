'use client';

import { useState } from 'react';
import {
  BADGE_RANK_LIMIT,
  METRIC_LABELS,
  TIER_LABELS,
  TIER_NEON,
  type LeaderboardMetric,
  type LeaderboardScope,
} from '@/lib/types';

export type TitleRow = { category: LeaderboardMetric; tier: 1 | 2 | 3; title: string };

/**
 * The prize table, straight from payout_for_rank(). Written out rather than
 * computed so the page can show it without a round trip; the SQL function
 * remains the authority, and this is a transcription of it.
 */
const PAYOUTS: { rank: string; notes: number }[] = [
  { rank: '1st', notes: 50 },
  { rank: '2nd', notes: 30 },
  { rank: '3rd', notes: 20 },
  { rank: '4th', notes: 15 },
  { rank: '5th', notes: 10 },
  { rank: '6th', notes: 8 },
  { rank: '7th', notes: 6 },
  { rank: '8th', notes: 5 },
  { rank: '9th', notes: 4 },
  { rank: '10th', notes: 3 },
  { rank: '11th–50th', notes: 1 },
];

const ORDER: LeaderboardMetric[] = [
  'likes',
  'funny',
  'loves',
  'dislikes',
  'daily_notes_spent',
  'premium_notes_spent',
];

/**
 * What the two boards are actually for.
 *
 * Scope-aware because the two windows reward completely different things and
 * showing both at once would be twice the reading for half the relevance:
 * Monthly pays NOTES and hands out Badges that reset; All Time hands out Titles
 * that never do.
 *
 * Collapsed by default. It is reference material -- useful once, then in the
 * way -- so it does not push the standings down the page on every visit.
 */
export default function RewardsPanel({
  scope,
  titles,
}: {
  scope: LeaderboardScope;
  titles: TitleRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((on) => !on)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-blush-50/60"
      >
        <span className="font-display text-sm font-semibold">
          {scope === 'monthly' ? 'What this month pays' : 'What all time earns you'}
        </span>
        <span aria-hidden className="text-xs text-ink/45">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-blush-100 px-5 py-4">
          {scope === 'monthly' ? (
            <>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                  Premium NOTES, paid on the 1st
                </h3>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                  {PAYOUTS.map((row) => (
                    <li key={row.rank} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-ink/60">{row.rank}</span>
                      <span className="font-semibold tabular-nums text-ink">{row.notes}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-ink/40">
                  Paid on every one of the six boards, separately. A tie shares the higher
                  rank, so two people tied at the top both take 50.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                  Badges
                </h3>
                <p className="text-xs text-ink/60">
                  The top {BADGE_RANK_LIMIT} of each board hold a Badge —{' '}
                  <span aria-hidden>🥇🥈🥉</span> — shown on your profile while you hold it.
                  Badges are live: they change hands the moment someone overtakes you, and
                  only whoever holds one when the month closes keeps it in their Badge history.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                Titles, by percentile
              </h3>
              <p className="text-xs text-ink/60">
                Recalculated monthly from all-time standings. Once earned, a Title is yours
                for good — it is never taken back.
              </p>

              <div className="space-y-3">
                {ORDER.map((metric) => {
                  const forMetric = titles.filter((t) => t.category === metric);
                  if (forMetric.length === 0) return null;
                  return (
                    <div key={metric} className="space-y-1">
                      <p className="text-[11px] font-semibold text-ink/45">
                        {METRIC_LABELS[metric]}
                      </p>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1">
                        {[1, 2, 3].map((tier) => {
                          const row = forMetric.find((t) => t.tier === tier);
                          if (!row) return null;
                          return (
                            <li key={tier} className="text-xs">
                              <span className="text-ink/50">{TIER_LABELS[tier]} → </span>
                              <span
                                className="font-display font-semibold"
                                style={{
                                  color: TIER_NEON[tier].color,
                                  textShadow: TIER_NEON[tier].glow,
                                }}
                              >
                                {row.title}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-ink/40">
                All Time pays no NOTES — the monthly boards do that. This is what it
                names you.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
