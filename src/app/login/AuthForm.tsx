'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { signIn, signUp, type AuthState } from '@/app/login/actions';

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

      {state.error ? <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{state.message}</p> : null}
    </div>
  );
}
