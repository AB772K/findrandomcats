import Link from 'next/link';
import { redirect } from 'next/navigation';
import SettingsForm from '@/app/settings/SettingsForm';
import PasswordSection from '@/app/settings/PasswordSection';
import TitlePicker from '@/app/settings/TitlePicker';
import { fetchProfileTitles, getMyProfile } from '@/lib/actions';
import { createClient, getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Your profile · FindRandomCats' };

export default async function SettingsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/');
  }

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [profile, { data: row }] = await Promise.all([
    getMyProfile(),
    supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  const titles = row?.id ? await fetchProfileTitles(row.id) : [];

  return (
    <div className="mx-auto max-w-md animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-sm text-ink/55">
          This is what other cat people see next to your comments.
        </p>
      </div>

      {/* Two accounts on this site means two different email addresses -- the
          same address cannot be registered twice. Showing which one you are
          signed in as is what makes that visible rather than mysterious. */}
      <p className="text-center text-xs text-ink/45">
        Signed in as <span className="font-medium text-ink/70">{user.email}</span>
      </p>

      <SettingsForm profile={profile} />

      {/* Its own card and its own action: titles are earned, not edited, so
          picking one is a different gesture from saving your bio. */}
      <TitlePicker titles={titles} selected={profile?.premium_display_title ?? null} />

      {/* An account with only a Google identity has no password to change, so
          it is offered one to set instead. changePassword() re-derives this
          from the identities itself -- this only decides what to ask for. */}
      <PasswordSection
        hasPassword={(user.identities ?? []).some((i) => i.provider === 'email')}
      />

      {row?.id ? (
        <p className="text-center text-sm">
          <Link href={`/u/${row.id}`} className="text-ink/50 underline transition hover:text-ink">
            View your public profile
          </Link>
        </p>
      ) : null}
    </div>
  );
}
