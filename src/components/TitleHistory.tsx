'use client';

import { useMemo, useState } from 'react';
import { TIER_LABELS, TIER_NEON, type ProfileTitleHistoryRow } from '@/lib/types';

/** How many months show before the list asks to be expanded. */
const VISIBLE_MONTHS = 6;

/**
 * The period is a date-only column, so it must be read as UTC. Parsed in local
 * time, '2026-09-01' becomes the 31st of August anywhere west of Greenwich --
 * and a section whose whole job is naming the right month cannot afford that.
 */
function monthLabel(period: string): string {
  const date = new Date(`${period}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * What this profile has held, month by month.
 *
 * Deliberately not deduplicated against the "Titles earned" section above: one
 * says what they hold now, the other what they held then, and a title can
 * honestly be the answer to both.
 */
export default function TitleHistory({ rows }: { rows: ProfileTitleHistoryRow[] }) {
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
              {monthLabel(period)}
            </span>
            <ul className="flex flex-1 flex-wrap gap-1.5">
              {titles.map((t) => (
                <li
                  key={`${t.category}-${t.period}`}
                  className="flex items-center gap-2 rounded-full border border-lilac-200 bg-lilac-50/70 px-3 py-1"
                >
                  <span
                    className="font-display text-sm font-semibold"
                    style={{ color: TIER_NEON[t.tier].color, textShadow: TIER_NEON[t.tier].glow }}
                  >
                    {t.title}
                  </span>
                  <span className="text-[11px] text-ink/50">
                    {t.label} · {TIER_LABELS[t.tier]}
                  </span>
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
