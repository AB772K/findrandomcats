'use client';

import { useMemo, useState } from 'react';
import TitleBadge from '@/components/TitleBadge';
import TitleCard from '@/components/TitleCard';
import { setDisplayTitle } from '@/lib/actions';
import {
  periodLabel,
  type ProfileTitle,
  type ProfileTitleHistoryRow,
} from '@/lib/types';

/**
 * One selectable Title: a name, the tier it sits in, and the FIRST month it was
 * held. The same name can appear in history across many months -- someone who
 * was "Regular" from March to June has four rows -- but it is one Title, earned
 * once, so it is offered once, under the month it was first earned.
 */
type Option = {
  title: string;
  label: string;
  tier: 1 | 2 | 3;
  category: string;
  /** First-of-month, or null for a legacy row with no period recorded. */
  period: string | null;
};

/**
 * Picks which earned Title to show beside your name -- ANY Title ever earned,
 * not only the tier held now.
 *
 * Titles are permanent, so a lower tier held earlier is still yours: someone
 * who was "Regular" in March and has since improved to "Addicted" may still
 * choose to display "March 2026 — Regular". Those earlier tiers live only in
 * Title history, which is why this reads both sources. The list is
 * presentation only; set_display_title() re-checks the same two tables
 * server-side, so a hand-rolled call cannot pin a Title nobody earned.
 */
export default function TitlePicker({
  titles,
  history,
  selected,
  owner,
}: {
  titles: ProfileTitle[];
  history: ProfileTitleHistoryRow[];
  selected: string | null;
  /** The account's display name, printed on each card. */
  owner: string;
}) {
  const [current, setCurrent] = useState<string | null>(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Every distinct Title, keyed by name, carrying the earliest month it was held.
  const options = useMemo(() => {
    const byTitle = new Map<string, Option>();
    const consider = (o: Option) => {
      const seen = byTitle.get(o.title);
      if (!seen) byTitle.set(o.title, o);
      else if (o.period && (!seen.period || o.period < seen.period)) byTitle.set(o.title, o);
    };
    for (const t of titles) {
      consider({ title: t.title, label: t.label, tier: t.tier, category: t.category, period: t.earned_period });
    }
    for (const h of history) {
      consider({ title: h.title, label: h.label, tier: h.tier, category: h.category, period: h.period });
    }
    return Array.from(byTitle.values());
  }, [titles, history]);

  // Grouped year -> month, newest first, so a long record reads as a timeline
  // rather than a pile. Titles with no recorded month sit under "Earlier".
  const groups = useMemo(() => {
    const years = new Map<string, Map<string, Option[]>>();
    for (const o of options) {
      const year = o.period ? o.period.slice(0, 4) : 'Earlier';
      const month = o.period ?? 'unknown';
      const months = years.get(year) ?? new Map<string, Option[]>();
      const list = months.get(month) ?? [];
      list.push(o);
      months.set(month, list);
      years.set(year, months);
    }
    return Array.from(years.entries())
      .sort(([a], [b]) => (a === 'Earlier' ? 1 : b === 'Earlier' ? -1 : b.localeCompare(a)))
      .map(([year, months]) => ({
        year,
        months: Array.from(months.entries())
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([month, list]) => ({
            month,
            titles: list.sort((x, y) => x.tier - y.tier || x.label.localeCompare(y.label)),
          })),
      }));
  }, [options]);

  const [openYear, setOpenYear] = useState<string | null>(groups[0]?.year ?? null);
  const currentOption = options.find((o) => o.title === current) ?? null;

  async function choose(title: string | null) {
    if (busy || title === current) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    const result = await setDisplayTitle(title);
    setBusy(false);

    if (result.ok) {
      setCurrent(result.title);
      setSaved(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <section className="card space-y-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold">Your Titles</h2>
        <span className="chip">{options.length ? `${options.length} earned` : 'None yet'}</span>
      </div>

      {options.length === 0 ? (
        <p className="rounded-2xl border border-blush-100 bg-blush-50/60 px-4 py-3 text-xs text-ink/55">
          Titles are earned by finishing in the top 3% of a category, all time — the four
          reaction boards and the two NOTES-spent ones. They are recalculated once a month,
          and once earned a Title is yours for good.
        </p>
      ) : (
        <>
          <p className="text-xs text-ink/50">
            Shown beside your name on your profile and on every comment you write. Every
            Title you have ever earned is here, by the month you earned it — pick any of them.
          </p>

          {/* Year tabs only when there is more than one year to choose between. */}
          {groups.length > 1 ? (
            <div role="tablist" aria-label="Year" className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g.year}
                  type="button"
                  role="tab"
                  aria-selected={openYear === g.year}
                  onClick={() => setOpenYear(g.year)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    openYear === g.year
                      ? 'border-blush-300 bg-blush-50 text-ink'
                      : 'border-blush-100 bg-paper text-ink/55 hover:text-ink'
                  }`}
                >
                  {g.year}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {groups
              .filter((g) => groups.length === 1 || g.year === openYear)
              .flatMap((g) => g.months)
              .map(({ month, titles: list }) => (
                <div key={month} className="space-y-1.5">
                  <p className="font-display text-xs font-semibold uppercase tracking-wide text-ink/45">
                    {month === 'unknown' ? 'Earlier' : periodLabel(month)}
                  </p>
                  <ul className="flex flex-wrap gap-4">
                    {list.map((o) => {
                      const on = current === o.title;
                      return (
                        <li key={o.title}>
                          <button
                            type="button"
                            onClick={() => choose(on ? null : o.title)}
                            disabled={busy}
                            aria-pressed={on}
                            className="rounded-2xl transition duration-200 disabled:opacity-50"
                          >
                            <TitleCard
                              title={o.title}
                              tier={o.tier}
                              label={o.label}
                              period={o.period}
                              owner={owner}
                              size="sm"
                              selected={on}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => choose(null)}
              disabled={busy || current === null}
              className="text-xs text-ink/50 underline transition hover:text-ink disabled:opacity-40"
            >
              Show no title
            </button>
            <span className="text-xs text-ink/45">
              {currentOption ? (
                <>
                  Displaying{' '}
                  <TitleBadge tier={currentOption.tier} period={currentOption.period}>
                    {currentOption.title}
                  </TitleBadge>
                </>
              ) : (
                'No title on display.'
              )}
            </span>
          </div>
        </>
      )}

      {/* The Premium mark is not in this list on purpose: it is not earned and
          not chosen, it just appears on comments a premium NOTE paid for. */}
      <p className="border-t border-blush-100 pt-3 text-[11px] text-ink/40">
        Separately, comments you post with a premium NOTE carry a{' '}
        <TitleBadge kind="premium">Premium</TitleBadge> mark automatically. It is not selectable,
        and it sits alongside your title rather than replacing it.
      </p>

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Saved.
        </p>
      ) : null}
    </section>
  );
}
