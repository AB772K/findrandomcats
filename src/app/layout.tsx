import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import AdblockNotice from '@/components/AdblockNotice';
import Nav from '@/components/Nav';
import { getNotesWallet } from '@/lib/actions';
import { createClient } from '@/lib/supabase/server';

/**
 * Fonts are committed to the repo and loaded with next/font/local rather than
 * next/font/google. Same self-hosting and same generated @font-face, but the
 * build no longer has to reach fonts.gstatic.com -- which makes CI and offline
 * builds deterministic instead of failing when Google is unreachable.
 *
 * Both files are the latin-subset variable builds, so one file covers every
 * weight the design uses.
 */
const display = localFont({
  src: './fonts/fredoka-latin-var.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
  fallback: ['ui-rounded', 'system-ui', 'sans-serif'],
});

const body = localFont({
  src: './fonts/nunito-latin-var.woff2',
  weight: '200 1000',
  style: 'normal',
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'FindRandomCats',
  description: 'Find a random cat, rate it out of 10, and argue about it in the comments.',
};

async function currentUser() {
  // Missing env vars would otherwise crash every page before setup is done.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { email: null, wallet: null, profile: null };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, wallet: null, profile: null };

  const [{ data }, wallet] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, profile_picture_url')
      .eq('user_id', user.id)
      .maybeSingle(),
    getNotesWallet(),
  ]);

  return {
    email: user.email ?? null,
    wallet,
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
  const { email, wallet, profile } = await currentUser();

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <AdblockNotice />
        <Nav email={email} wallet={wallet} profile={profile} />
        <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 pb-12 text-center text-xs text-ink/40">
          Cat photos from The Cat API and our users. Ads keep the lights on.
        </footer>
      </body>
    </html>
  );
}
