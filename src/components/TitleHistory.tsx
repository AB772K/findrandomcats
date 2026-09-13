'use client';

import { useMemo, useState } from 'react';
import TitleCard from '@/components/TitleCard';
import { periodLabel, type ProfileTitleHistoryRow } from '@/lib/types';

/** How many months show before the list asks to be expanded. */
const VISIBLE_MONTHS = 6;

/**
 * What this profile has held, month by month.
 *
 * Deliberately not deduplicated against the "Titles earned" section above: one
 * says what they hold now, the other what they held then, and a title can
 * honestly be the answer to both.
 */
export default function TitleHistory({ rows, owner }: { rows: ProfileTitleHistoryRow[]; owner: string }) {
  const [expanded, setExpanded] = useState(false);

  // Already ordered newest-first by the query; grouped here so a month reads as
  // one line of titles rather than one row per category.
  const months = useMemo(() => {
    const byPeriod = new Map<string, ProfileTitleHistoryRow[]>();
    for (const row of rows) {
      const group = byPeriod.get(row.period) ?? [];
      group.push(row);
      byPeriod.set(row.period, group);
    }
    return Array.from(byPeriod, ([period, titles]) => ({ period, titles }));
  }, [rows]);

  if (months.length === 0) return null;

  const shown = expanded ? months : months.slice(0, VISIBLE_MONTHS);
  const hidden = months.length - shown.length;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold">Title history</h2>
        <span className="text-xs text-ink/45">
          {months.length} {months.length === 1 ? 'month' : 'months'}
        </span>
      </div>

      <ol className="space-y-3">
        {shown.map(({ period, titles }) => (
          <li key={period} className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
            <span className="shrink-0 pt-0.5 font-display text-xs font-semibold uppercase tracking-wide text-ink/45 sm:w-32">
              {periodLabel(period)}
            </span>
            <ul className="flex flex-1 flex-wrap gap-4">
              {titles.map((t) => (
                <li key={`${t.category}-${t.period}`}>
                  <TitleCard
                    title={t.title}
                    tier={t.tier}
                    label={t.label}
                    period={t.period}
                    owner={owner}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((on) => !on)}
          className="mt-3 text-xs text-ink/50 underline transition hover:text-ink"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} earlier ${hidden === 1 ? 'month' : 'months'}`}
        </button>
      ) : null}
    </section>
  );
}
