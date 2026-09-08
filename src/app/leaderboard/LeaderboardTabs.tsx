'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Avatar from '@/components/Avatar';
import { fetchLeaderboard } from '@/lib/actions';
import { displayNameOf } from '@/lib/avatar';
import type { LeaderboardMetric, LeaderboardRow } from '@/lib/types';

export const BOARDS: { metric: LeaderboardMetric; tab: string; heading: string; unit: string }[] = [
  { metric: 'likes', tab: '\u{1F44D} Likes', heading: 'Most likes received', unit: 'likes' },
  { metric: 'funny', tab: '\u{1F602} Funny', heading: 'Most funny received', unit: 'funny' },
  { metric: 'loves', tab: '❤️ Hearts', heading: 'Most hearts received', unit: 'hearts' },
  { metric: 'dislikes', tab: '\u{1F44E} Dislikes', heading: 'Most dislikes received', unit: 'dislikes' },
  { metric: 'daily_notes_spent', tab: 'Daily NOTES', heading: 'Most daily NOTES spent', unit: 'spent' },
  { metric: 'premium_notes_spent', tab: 'Premium NOTES', heading: 'Most premium NOTES spent', unit: 'spent' },
];

/** Medal for the top three, plain number after that. */
const RANKS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export default function LeaderboardTabs({
  initialMetric,
  initialRows,
}: {
  initialMetric: LeaderboardMetric;
  initialRows: LeaderboardRow[];
}) {
  const [metric, setMetric] = useState<LeaderboardMetric>(initialMetric);
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  // Cached per metric so flipping back to a tab is instant.
  const [cache, setCache] = useState<Partial<Record<LeaderboardMetric, LeaderboardRow[]>>>({
    [initialMetric]: initialRows,
  });
  const [pending, startTransition] = useTransition();

  function select(next: LeaderboardMetric) {
    if (next === metric) return;
    setMetric(next);

    const cached = cache[next];
    if (cached) {
      setRows(cached);
      return;
    }

    startTransition(async () => {
      const fresh = await fetchLeaderboard(next);
      setCache((prev) => ({ ...prev, [next]: fresh }));
      setRows(fresh);
    });
  }

  const active = BOARDS.find((b) => b.metric === metric) ?? BOARDS[0];

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Leaderboards" className="flex flex-wrap gap-1.5">
        {BOARDS.map((board) => {
          const on = board.metric === metric;
          return (
            <button
              key={board.metric}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(board.metric)}
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
          <h2 className="font-display text-base font-semibold">{active.heading}</h2>
          <span className="text-xs text-ink/45">
            {rows.length > 0 ? `Top ${rows.length}` : 'Top 50'}
          </span>
        </div>

        {pending ? (
          <p className="py-6 text-center text-sm text-ink/45">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/45">
            Nobody is on this board yet — be the first.
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
