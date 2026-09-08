'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { signIn, signInWithGoogle, signUp, type AuthState } from '@/app/login/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Working…' : label}
    </button>
  );
}

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction] = useFormState<AuthState, FormData>(action, {});
  // Its own state: signInWithGoogle takes no form data, and on success it never
  // returns at all -- it redirects to Google.
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [goingToGoogle, setGoingToGoogle] = useState(false);

  async function google() {
    setGoogleError(null);
    setGoingToGoogle(true);
    const result = await signInWithGoogle();
    // Only reached when the handoff failed; otherwise we have already left.
    setGoingToGoogle(false);
    if (result?.error) setGoogleError(result.error);
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-lilac-50 p-1 text-sm">
        {(['signin', 'signup'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-full px-3 py-1.5 font-medium transition duration-300 ${
              mode === option ? 'bg-paper text-ink shadow-soft' : 'text-ink/55 hover:text-ink'
            }`}
          >
            {option === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/55">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/55">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            className="field"
          />
        </label>

        <SubmitButton label={mode === 'signin' ? 'Sign in' : 'Create account'} />
      </form>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-ink/35">
        <span className="h-px flex-1 bg-blush-100" />
        or
        <span className="h-px flex-1 bg-blush-100" />
      </div>

      {/* One button for both modes: with Google there is no difference between
          signing in and signing up, so offering the choice would be a lie. */}
      <button
        type="button"
        onClick={google}
        disabled={goingToGoogle}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-blush-100 bg-paper px-4 py-2.5 text-sm font-medium text-ink shadow-soft transition duration-200 hover:border-lilac-200 disabled:opacity-50"
      >
        <svg viewBox="0 0 18 18" aria-hidden className="h-4 w-4">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
        </svg>
        {goingToGoogle ? 'Taking you to Google…' : 'Continue with Google'}
      </button>

      {googleError ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {googleError}
        </p>
      ) : null}

      {state.error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{state.message}</p> : null}
    </div>
  );
}
