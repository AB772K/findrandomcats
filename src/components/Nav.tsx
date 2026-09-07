import Link from 'next/link';
import { signOut } from '@/lib/actions';

export default function Nav({
  email,
  notesBalance,
}: {
  email: string | null;
  notesBalance: number | null;
}) {
  return (
    <header className="border-b border-ink/10 bg-cream/80 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-base font-bold tracking-tight">
          FindRandomCats
        </Link>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {email ? (
            <>
              <span
                title="NOTES are spent on comments"
                className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
              >
                {notesBalance ?? 0} NOTES
              </span>
              <Link href="/upload" className="text-ink/70 hover:text-ink">
                Upload
              </Link>
              <span className="hidden text-xs text-ink/40 sm:inline">{email}</span>
              <form action={signOut}>
                <button type="submit" className="text-ink/70 underline hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="font-medium text-ink/80 hover:text-ink">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
