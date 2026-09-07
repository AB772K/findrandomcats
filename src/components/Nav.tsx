import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { signOut } from '@/lib/actions';
import type { NotesWallet } from '@/lib/types';

export type NavProfile = {
  id: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export default function Nav({
  email,
  wallet,
  profile,
}: {
  email: string | null;
  wallet: NotesWallet | null;
  profile: NavProfile | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-blush-100 bg-paper/90 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight transition duration-200 hover:opacity-70"
        >
          <span className="text-blush-500">FindRandomCats</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
          {email ? (
            <>
              <Link
                href="/notes"
                title="Daily notes refill every 24h; premium notes never expire"
                className="chip transition duration-200 hover:border-lilac-200"
              >
                {wallet?.daily_notes_balance ?? 0}
                <span className="font-normal text-ink/45"> daily</span>
                {(wallet?.premium_notes_balance ?? 0) > 0 ? (
                  <>
                    {' · '}
                    <span className="text-lilac-400">{wallet?.premium_notes_balance}</span>
                    <span className="font-normal text-ink/45"> premium</span>
                  </>
                ) : null}
              </Link>

              <Link href="/upload" className="text-ink/65 transition hover:text-ink">
                Upload
              </Link>
              <Link href="/settings" className="text-ink/65 transition hover:text-ink">
                Settings
              </Link>

              {profile ? (
                <Link
                  href={`/u/${profile.id}`}
                  title="Your public profile"
                  className="transition duration-200 hover:opacity-80"
                >
                  <Avatar
                    name={profile.displayName ?? email}
                    url={profile.pictureUrl}
                    seed={profile.id}
                    size="sm"
                  />
                </Link>
              ) : null}

              <form action={signOut}>
                <button type="submit" className="text-ink/55 transition hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
