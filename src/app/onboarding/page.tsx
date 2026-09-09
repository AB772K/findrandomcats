import { redirect } from 'next/navigation';
import NicknameForm from '@/app/onboarding/NicknameForm';
import { getMyProfile } from '@/lib/actions';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a nickname · FindRandomCats' };

/**
 * The one step between signing up and using the site.
 *
 * Reached the same way from both paths -- email/password and Google -- because
 * the gate is on the profile having no display_name, not on how the account was
 * created. Anyone who already has one is sent on, so this page cannot be a
 * dead end for an existing user who wanders in.
 */
export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const profile = await getMyProfile();
  if (profile?.display_name) redirect('/');

  return (
    <div className="mx-auto max-w-sm animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Choose a nickname</span>
        </h1>
        <p className="text-sm text-ink/55">
          This is the name on your comments and your profile. It has to be unique, and
          you can change it later in settings.
        </p>
      </div>

      <NicknameForm />
    </div>
  );
}
