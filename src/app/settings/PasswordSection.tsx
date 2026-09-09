'use client';

import { useState } from 'react';
import { changePassword } from '@/lib/actions';

/**
 * Change (or, for a Google-only account, set) the password.
 *
 * `hasPassword` only decides what to ask for. changePassword() re-derives it
 * from the account's own identities and does the verifying, so hiding the
 * current-password field is presentation, not the check.
 */
export default function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = next.length >= 6 && next === confirm && (!hasPassword || current.length > 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);
    setDone(false);

    const result = await changePassword(current, next);
    setBusy(false);

    if (result.ok) {
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      return;
    }
    setError(result.error);
  }

  return (
    <section className="card space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold">
          {hasPassword ? 'Change password' : 'Set a password'}
        </h2>
        <p className="text-xs text-ink/55">
          {hasPassword
            ? 'You will need your current one.'
            : 'You signed in with Google, so this account has no password yet. Setting one lets you sign in either way.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {hasPassword ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink/55">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              className="field"
            />
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/55">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className="field"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/55">Confirm it</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="field"
          />
        </label>

        <p aria-live="polite" className="min-h-[1rem] text-xs">
          {mismatch ? (
            <span className="font-medium text-rose-700">Those two do not match.</span>
          ) : next.length > 0 && next.length < 6 ? (
            <span className="text-ink/45">At least 6 characters.</span>
          ) : null}
        </p>

        <button type="submit" disabled={!ready || busy} className="btn-primary w-full">
          {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {hasPassword ? 'Password changed.' : 'Password set. You can now sign in with it too.'}
        </p>
      ) : null}
    </section>
  );
}
