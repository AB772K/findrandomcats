'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: 'Email and password are both required.' };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: 'Email and password are both required.' };
  if (password.length < 6) return { error: 'Use at least 6 characters for your password.' };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // With email confirmation on, signUp returns no session -- tell them to check
  // mail, and say why it matters beyond just signing in. Supabase links a Google
  // identity to an existing account only when that account's email is already
  // verified; an unconfirmed one is deliberately not linked, because linking to
  // an address nobody has proven they own is a pre-account-takeover hole. So
  // confirming is what makes "Continue with Google" later land on THIS account.
  if (!data.session) {
    return {
      message:
        'Check your inbox to confirm your email. Confirming is also what lets ' +
        'Continue with Google find this account later.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Hands the visitor off to Google.
 *
 * Supabase does the handshake; all we do is name where it should come back to
 * and follow the URL it gives us. The origin is read from the request rather
 * than an env var so this works unchanged on localhost and in production --
 * whichever host the user is actually on is the one Google returns them to.
 *
 * redirect() throws to perform the navigation, so it must sit outside the
 * try/catch-free path above and after every use of the response.
 */
export async function signInWithGoogle(): Promise<AuthState> {
  const supabase = createClient();
  const origin = headers().get('origin') ?? `http://${headers().get('host') ?? 'localhost:3000'}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    // The provider being switched off in the Supabase dashboard is by far the
    // likeliest cause, and the raw message does not say so.
    return {
      error: /provider is not enabled/i.test(error.message)
        ? 'Google sign-in is not switched on for this project yet.'
        : error.message,
    };
  }
  if (!data.url) return { error: 'Google sign-in is unavailable right now.' };

  redirect(data.url);
}

/**
 * Sends a password reset link.
 *
 * Always reports success, whatever the lookup found. Saying "no account with
 * that email" would turn this form into a way to test which addresses are
 * registered, and the person who genuinely owns the address learns nothing from
 * it that the inbox will not tell them.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter the email you signed up with.' };

  const supabase = createClient();
  const origin = headers().get('origin') ?? `http://${headers().get('host') ?? 'localhost:3000'}`;

  // Through /auth/callback, not straight to the form: the code has to be
  // exchanged somewhere a session cookie can be written, and a Route Handler
  // is one of the few places Next permits that.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  // Rate limiting is the one failure worth surfacing: it is about the request,
  // not about whether the account exists.
  if (error && /rate limit|too many/i.test(error.message)) {
    return { error: 'Too many reset emails just now. Try again in a few minutes.' };
  }

  return {
    message: 'If that email has an account, a reset link is on its way. It expires shortly.',
  };
}

export type PasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Sets a new password using the session the recovery link established.
 *
 * No current password is asked for here, and that is the point of the flow:
 * possession of the emailed link IS the proof. The session only exists because
 * the code from that link was exchanged, so an expired or reused link leaves
 * nobody signed in and this refuses.
 */
export async function setNewPassword(password: string): Promise<PasswordResult> {
  if (password.length < 6) return { ok: false, error: 'Use at least 6 characters.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'That reset link has expired or was already used.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
