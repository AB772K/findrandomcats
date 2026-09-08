'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Avatar from '@/components/Avatar';
import { fetchLeaderboard } from '@/lib/actions';
import { displayNameOf } from '@/lib/avatar';
import type { LeaderboardMetric, LeaderboardRow, LeaderboardScope } from '@/lib/types';

export const BOARDS: { metric: LeaderboardMetric; tab: string; heading: string; unit: string }[] = [
  { metric: 'likes', tab: '\u{1F44D} Likes', heading: 'Most likes received', unit: 'likes' },
  { metric: 'funny', tab: '\u{1F602} Funny', heading: 'Most funny received', unit: 'funny' },
  { metric: 'loves', tab: '❤️ Hearts', heading: 'Most hearts received', unit: 'hearts' },
  { metric: 'dislikes', tab: '\u{1F44E} Dislikes', heading: 'Most dislikes received', unit: 'dislikes' },
  {
    metric: 'daily_notes_spent',
    tab: '\u{1F4DD} Daily spent',
    heading: 'Most daily NOTES spent',
    unit: 'daily',
  },
  {
    metric: 'premium_notes_spent',
    tab: '\u2728 Premium spent',
    heading: 'Most premium NOTES spent',
    unit: 'premium',
  },
];

/** Medal for the top three, plain number after that. */
const RANKS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

const SCOPES: { scope: LeaderboardScope; label: string; blurb: string }[] = [
  { scope: 'monthly', label: 'Monthly', blurb: 'So far this calendar month.' },
  { scope: 'all-time', label: 'All Time', blurb: 'Everything, ever.' },
];

/** Cache key: a board is a scope AND a metric, not one or the other. */
const keyOf = (scope: LeaderboardScope, metric: LeaderboardMetric) => `${scope}:${metric}`;

export default function LeaderboardTabs({
  initialScope,
  initialMetric,
  initialRows,
}: {
  initialScope: LeaderboardScope;
  initialMetric: LeaderboardMetric;
  initialRows: LeaderboardRow[];
}) {
  const [scope, setScope] = useState<LeaderboardScope>(initialScope);
  const [metric, setMetric] = useState<LeaderboardMetric>(initialMetric);
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  // Cached per scope+metric so flipping between the twelve boards stays instant.
  const [cache, setCache] = useState<Record<string, LeaderboardRow[]>>({
    [keyOf(initialScope, initialMetric)]: initialRows,
  });
  const [pending, startTransition] = useTransition();

  function show(nextScope: LeaderboardScope, nextMetric: LeaderboardMetric) {
    if (nextScope === scope && nextMetric === metric) return;
    setScope(nextScope);
    setMetric(nextMetric);

    const cached = cache[keyOf(nextScope, nextMetric)];
    if (cached) {
      setRows(cached);
      return;
    }

    startTransition(async () => {
      const fresh = await fetchLeaderboard(nextMetric, nextScope);
      setCache((prev) => ({ ...prev, [keyOf(nextScope, nextMetric)]: fresh }));
      setRows(fresh);
    });
  }

  const active = BOARDS.find((b) => b.metric === metric) ?? BOARDS[0];
  const activeScope = SCOPES.find((s) => s.scope === scope) ?? SCOPES[0];
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Scope first: it changes what every category below means, so it reads
          as the parent choice rather than a fifth sibling tab. */}
      <div className="flex flex-col gap-2">
        <div
          role="tablist"
          aria-label="Leaderboard period"
          className="inline-flex self-start rounded-full border border-blush-200 bg-paper p-1"
        >
          {SCOPES.map((option) => {
            const on = option.scope === scope;
            return (
              <button
                key={option.scope}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => show(option.scope, metric)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition duration-200 ${
                  on ? 'bg-blush-400 text-white shadow-soft' : 'text-ink/55 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink/45">
          {activeScope.blurb}
          {scope === 'monthly' ? ` (${monthLabel})` : null}
        </p>
      </div>

      <div role="tablist" aria-label="Leaderboards" className="flex flex-wrap gap-1.5">
        {BOARDS.map((board) => {
          const on = board.metric === metric;
          return (
            <button
              key={board.metric}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => show(scope, board.metric)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200 ${
                on
                  ? 'border-blush-300 bg-blush-50 text-ink'
                  : 'border-blush-100 bg-paper text-ink/55 hover:border-lilac-200 hover:text-ink'
              }`}
            >
              {board.tab}
            </button>
          );
        })}
      </div>

      <section className="card p-5 sm:p-6" aria-live="polite">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            {active.heading}
            <span className="ml-2 font-sans text-xs font-normal text-ink/45">
              {scope === 'monthly' ? monthLabel : 'all time'}
            </span>
          </h2>
          <span className="text-xs text-ink/45">
            {rows.length > 0 ? `Top ${rows.length}` : 'Top 50'}
          </span>
        </div>

        {pending ? (
          <p className="py-6 text-center text-sm text-ink/45">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/45">
            {scope === 'monthly'
              ? 'Nobody is on this board yet this month — be the first.'
              : 'Nobody is on this board yet — be the first.'}
          </p>
        ) : (
          <ol className="space-y-1">
            {rows.map((row, index) => (
              <li key={row.profile_id}>
                <Link
                  href={`/u/${row.profile_id}`}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 transition duration-200 hover:bg-blush-50/70"
                >
                  <span className="w-7 shrink-0 text-center text-sm tabular-nums text-ink/50">
                    {RANKS[index] ?? index + 1}
                  </span>
                  <Avatar
                    name={row.display_name}
                    url={row.profile_picture_url}
                    seed={row.profile_id}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-ink">
                    {displayNameOf(row.display_name)}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink/70">
                    {Number(row.score).toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-ink/40">{active.unit}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
