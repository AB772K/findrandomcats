import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';
import AdblockNotice from '@/components/AdblockNotice';
import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';

// Self-hosted by next/font at build time -- no render-blocking request to Google.
const display = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Nunito({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FindRandomCats',
  description: 'Find a random cat, rate it out of 10, and argue about it in the comments.',
};

async function currentUser() {
  // Missing env vars would otherwise crash every page before setup is done.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { email: null, notesBalance: null, profile: null };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, notesBalance: null, profile: null };

  const { data } = await supabase
    .from('profiles')
    .select('id, notes_balance, display_name, profile_picture_url')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    email: user.email ?? null,
    notesBalance: data?.notes_balance ?? 0,
    profile: data
      ? {
          id: data.id as string,
          displayName: (data.display_name as string | null) ?? null,
          pictureUrl: (data.profile_picture_url as string | null) ?? null,
        }
      : null,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { email, notesBalance, profile } = await currentUser();

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <AdblockNotice />
        <Nav email={email} notesBalance={notesBalance} profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-12 text-center text-xs text-ink/40">
          Cat photos from The Cat API and our users. Ads keep the lights on.
        </footer>
      </body>
    </html>
  );
}
