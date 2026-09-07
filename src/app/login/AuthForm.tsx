'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { signIn, signUp, type AuthState } from '@/app/login/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink/85 disabled:opacity-50"
    >
      {pending ? 'Working…' : label}
    </button>
  );
}

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction] = useFormState<AuthState, FormData>(action, {});

  return (
    <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink/5 p-1 text-sm">
        {(['signin', 'signup'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === option ? 'bg-white shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {option === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/60">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink/60">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40"
          />
        </label>

        <SubmitButton label={mode === 'signin' ? 'Sign in' : 'Create account'} />
      </form>

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
    </div>
  );
}
