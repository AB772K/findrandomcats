import { ChooseNewPassword, RequestAgain } from '@/app/auth/reset-password/ResetPasswordForm';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Set a new password · FindRandomCats' };

/**
 * Where a password reset link lands, after /auth/callback has exchanged its
 * code for a session.
 *
 * Having that session is the whole test. The link is single-use and expires, so
 * an expired or already-clicked one leaves nobody signed in -- which is exactly
 * how this page tells the two cases apart, without needing to inspect the token
 * itself. Either they can set a password, or they are offered a fresh link.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getSessionUser();

  return (
    <div className="mx-auto max-w-sm animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">
            {user ? 'Set a new password' : 'That link is no longer good'}
          </span>
        </h1>
        {user ? (
          <p className="text-sm text-ink/55">
            Pick something new for <span className="font-medium text-ink/70">{user.email}</span>.
          </p>
        ) : null}
      </div>

      {user ? <ChooseNewPassword /> : <RequestAgain reason={searchParams.error ?? null} />}
    </div>
  );
}
