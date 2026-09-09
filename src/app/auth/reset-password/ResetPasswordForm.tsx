'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, setNewPassword, type AuthState } from '@/app/login/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Working…' : label}
    </button>
  );
}

/** Asks for a fresh link. Shown when the one they clicked is no longer good. */
export function RequestAgain({ reason }: { reason: string | null }) {
  const [state, formAction] = useFormState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <div className="card space-y-4 p-6">
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {reason ?? 'That reset link has expired or was already used.'}
      </p>
      <p className="text-sm text-ink/60">Send yourself a new one:</p>
      <form action={formAction} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/55">Email</span>
          <input name="email" type="email" autoComplete="email" required className="field" />
        </label>
        <SubmitButton label="Email me a new link" />
      </form>
      {state.error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.message}
        </p>
      ) : null}
      <p className="text-center text-xs">
        <Link href="/login" className="text-ink/50 underline transition hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/** Sets the new password. Only rendered when the recovery link left a session. */
export function ChooseNewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= 6 && password === confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);
    const result = await setNewPassword(password);

    if (result.ok) {
      setDone(true);
      setBusy(false);
      return;
    }
    setBusy(false);
    setError(result.error);
  }

  if (done) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your password is set. You are signed in.
        </p>
        <Link href="/" className="btn-primary inline-block">
          Go find a cat
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/55">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        ) : password.length > 0 && password.length < 6 ? (
          <span className="text-ink/45">At least 6 characters.</span>
        ) : null}
      </p>

      <button type="submit" disabled={!ready || busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Set new password'}
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
