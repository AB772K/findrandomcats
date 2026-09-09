'use client';

import { useEffect, useRef, useState } from 'react';
import { checkNickname, saveProfile, type NicknameCheck } from '@/lib/actions';

/** Long enough that a fast typist is not checked mid-word, short enough to feel live. */
const DEBOUNCE_MS = 400;

// Separate members rather than a union of kinds inside one, so narrowing by
// `kind` actually reaches the fields that only exist on a result.
type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | ({ kind: 'result' } & NicknameCheck);

export default function NicknameForm() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the newest check may write to state: a slow early request must not
  // land after a fast later one and answer for a name no longer in the box.
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: 'idle' });
      return;
    }

    setStatus({ kind: 'checking' });
    const seq = ++latest.current;
    const timer = setTimeout(async () => {
      const result = await checkNickname(trimmed);
      if (seq === latest.current) setStatus({ kind: 'result', ...result });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [name]);

  const available = status.kind === 'result' && status.state === 'available';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!available || saving) return;

    setSaving(true);
    setError(null);

    // Through saveProfile -> update_my_profile(), the same path /settings uses.
    // The live check above is advisory; this is where the constraint decides.
    const form = new FormData();
    form.set('display_name', name.trim());
    form.set('bio', '');
    const result = await saveProfile(form);

    if (result.ok) {
      // A full load, not a client transition: the layout decides whether the
      // onboarding gate still applies, and it has to re-run to let us past.
      window.location.assign('/');
      return;
    }

    setSaving(false);
    setError(result.error);
    // Lost the race to someone saving the same name between check and submit.
    if (/already taken/i.test(result.error)) setStatus({ kind: 'result', state: 'taken' });
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink/55">Nickname</span>
        <input
          name="nickname"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          autoComplete="off"
          maxLength={40}
          placeholder="whiskers_fan"
          aria-describedby="nickname-status"
          className="field"
        />
      </label>

      {/* aria-live so the verdict is announced, not just coloured. */}
      <p id="nickname-status" aria-live="polite" className="min-h-[1.25rem] text-xs">
        {status.kind === 'idle' ? (
          <span className="text-ink/45">Letters, numbers, whatever you like — 2 to 40 characters.</span>
        ) : status.kind === 'checking' ? (
          <span className="text-ink/45">Checking…</span>
        ) : status.state === 'available' ? (
          <span className="font-medium text-emerald-700">“{name.trim()}” is available.</span>
        ) : status.state === 'taken' ? (
          <span className="font-medium text-rose-700">“{name.trim()}” is taken.</span>
        ) : (
          <span className="font-medium text-rose-700">{status.reason}</span>
        )}
      </p>

      <button type="submit" disabled={!available || saving} className="btn-primary w-full">
        {saving ? 'Saving…' : 'Continue'}
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
