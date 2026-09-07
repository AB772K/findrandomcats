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
              mode === option ? 'bg-white text-ink shadow-soft' : 'text-ink/55 hover:text-ink'
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

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      {state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
    </div>
  );
}
