import Link from 'next/link';
import CatFeed from '@/components/CatFeed';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <h1 className="mb-2 text-lg font-bold">Almost there</h1>
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

  let notes: number | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('notes_balance')
      .eq('user_id', user.id)
      .maybeSingle();
    notes = data?.notes_balance ?? 0;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2 text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Find a Random Cat</h1>
        <p className="text-sm text-ink/60">
          Rate it out of 10. Comment for 1 NOTE.{' '}
          {user ? null : (
            <Link href="/login" className="underline hover:text-ink">
              Sign up for 3 free NOTES
            </Link>
          )}
        </p>
      </section>

      <CatFeed signedIn={Boolean(user)} initialNotes={notes} />
    </div>
  );
}
