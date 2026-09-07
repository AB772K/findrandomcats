import type { Metadata } from 'next';
import './globals.css';
import AdblockNotice from '@/components/AdblockNotice';
import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'FindRandomCats',
  description: 'Find a random cat, rate it out of 10, and argue about it in the comments.',
};

async function currentUser() {
  // Missing env vars would otherwise crash every page before setup is done.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { email: null, notesBalance: null };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, notesBalance: null };

  const { data } = await supabase
    .from('profiles')
    .select('notes_balance')
    .eq('user_id', user.id)
    .maybeSingle();

  return { email: user.email ?? null, notesBalance: data?.notes_balance ?? 0 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { email, notesBalance } = await currentUser();

  return (
    <html lang="en">
      <body>
        <AdblockNotice />
        <Nav email={email} notesBalance={notesBalance} />
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-ink/40">
          Cat photos from The Cat API and our users. Ads keep the lights on.
        </footer>
      </body>
    </html>
  );
}
