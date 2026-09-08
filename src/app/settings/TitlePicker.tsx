'use client';

import { useState } from 'react';
import TitleBadge from '@/components/TitleBadge';
import { setDisplayTitle } from '@/lib/actions';
import { TIER_LABELS, type ProfileTitle } from '@/lib/types';

/**
 * Picks which earned title to show beside your name. The list is exactly what
 * profile_titles() returned, but that is presentation only -- set_display_title()
 * re-checks the badge server-side, so a hand-rolled call cannot pin a title
 * nobody earned.
 */
export default function TitlePicker({
  titles,
  selected,
}: {
  titles: ProfileTitle[];
  selected: string | null;
}) {
  const [current, setCurrent] = useState<string | null>(selected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        <h2 className="font-display text-base font-semibold">Your titles</h2>
        <span className="chip">{titles.length ? `${titles.length} earned` : 'None yet'}</span>
      </div>

      {titles.length === 0 ? (
        <p className="rounded-2xl border border-blush-100 bg-blush-50/60 px-4 py-3 text-xs text-ink/55">
          Titles are earned by finishing in the top 3% of a category, all time — the four
          reaction boards and the two NOTES-spent ones. They are recalculated once a month,
          so keep collecting hearts, likes and laughs.
        </p>
      ) : (
        <>
          <p className="text-xs text-ink/50">
            Shown beside your name on your profile and on every comment you write.
          </p>

          <ul className="flex flex-wrap gap-2">
            {titles.map((t) => {
              const on = current === t.title;
              return (
                <li key={`${t.category}-${t.tier}`}>
                  <button
                    type="button"
                    onClick={() => choose(on ? null : t.title)}
                    disabled={busy}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition duration-200 disabled:opacity-50 ${
                      on
                        ? 'border-blush-400 bg-blush-50'
                        : 'border-blush-100 bg-paper hover:border-lilac-200'
                    }`}
                  >
                    <span className="font-display text-sm font-semibold text-ink">{t.title}</span>
                    <span className="text-[11px] text-ink/50">
                      {t.label} · {TIER_LABELS[t.tier]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

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
              {current ? (
                <>
                  Displaying <TitleBadge>{current}</TitleBadge>
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
