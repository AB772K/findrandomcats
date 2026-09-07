import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { signOut } from '@/lib/actions';

export type NavProfile = {
  id: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export default function Nav({
  email,
  notesBalance,
  profile,
}: {
  email: string | null;
  notesBalance: number | null;
  profile: NavProfile | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/50 bg-white/60 backdrop-blur-md">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight transition duration-300 hover:opacity-70"
        >
          <span className="bg-gradient-to-r from-blush-400 to-lilac-400 bg-clip-text text-transparent">
            FindRandomCats
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 text-sm sm:gap-3">
          {email ? (
            <>
              <span
                title="NOTES are spent on comments"
                className="rounded-full bg-gradient-to-r from-blush-100 to-lilac-100 px-3 py-1 text-xs font-semibold text-ink/75 shadow-soft"
              >
                {notesBalance ?? 0} NOTES
              </span>

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
                  className="transition duration-300 hover:-translate-y-0.5"
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
