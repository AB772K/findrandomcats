'use client';

import { useEffect, useState } from 'react';

const VISIBLE_MS = 5500;
const FADE_MS = 400;

/**
 * Full-width confirmation banner. Pinned to the top of the viewport rather than
 * placed in the page flow, so it cannot be scrolled past or missed among the
 * form -- the previous confirmation was a small inline link that gave no clear
 * "this worked" moment.
 *
 * Stays put for VISIBLE_MS with no interaction needed, then fades. The dismiss
 * button is there for people who want it gone sooner, not because noticing it
 * requires a click.
 */
export default function SuccessToast({
  message,
  emoji = '🐱',
}: {
  message: string;
  emoji?: string;
}) {
  const [state, setState] = useState<'in' | 'out' | 'gone'>('in');

  useEffect(() => {
    const fade = window.setTimeout(() => setState('out'), VISIBLE_MS);
    const remove = window.setTimeout(() => setState('gone'), VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (state === 'gone') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        state === 'out' ? '-translate-y-3 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="border-b border-emerald-200 bg-emerald-50/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-base font-bold text-white shadow-soft"
          >
            ✓
          </span>
          <p className="flex-1 font-display text-base font-semibold text-emerald-900">
            {message} <span aria-hidden>{emoji}</span>
          </p>
          <button
            type="button"
            onClick={() => setState('out')}
            aria-label="Dismiss"
            className="shrink-0 rounded-full px-2 py-1 text-sm text-emerald-700/70 transition hover:bg-emerald-100 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
