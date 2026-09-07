import Link from 'next/link';
import CatFeed from '@/components/CatFeed';
import { getNotesWallet } from '@/lib/actions';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!configured) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h1 className="mb-2 font-display text-lg font-bold">Almost there</h1>
        <p>
          Copy <code className="font-mono">.env.local.example</code> to{' '}
          <code className="font-mono">.env.local</code>, add your Supabase URL and anon key, run{' '}
          <code className="font-mono">supabase/schema.sql</code> in the SQL editor, then restart{' '}
          <code className="font-mono">npm run dev</code>.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getNotesWallet() also applies any owed 24h top-up, so landing on the home
  // page is enough to refill the daily notes.
  const wallet = user ? await getNotesWallet() : null;

  return (
    <div className="space-y-8">
      <section className="animate-fade-up space-y-2 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-blush-500">Find a Random Cat</span>
        </h1>
        <p className="text-sm text-ink/55">
          Rate it out of 10. Comment for 1 NOTE.{' '}
          {user ? null : (
            <Link
              href="/login"
              className="font-semibold text-lilac-400 underline decoration-lilac-200 underline-offset-2 transition hover:text-blush-500"
            >
              Sign up for 3 free NOTES
            </Link>
          )}
        </p>
      </section>

      <CatFeed signedIn={Boolean(user)} initialWallet={wallet} />
    </div>
  );
}
