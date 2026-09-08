import Link from 'next/link';
import { redirect } from 'next/navigation';
import DailyResetCountdown from '@/app/notes/DailyResetCountdown';
import VideoAdSlot from '@/components/VideoAdSlot';
import { getNotesWallet } from '@/lib/actions';
import { NOTE_PACKAGES } from '@/lib/notes';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { DAILY_NOTES_ALLOWANCE } from '@/lib/types';

export const metadata = { title: 'Your NOTES · FindRandomCats' };

// The balance moves on every comment and tops itself up on view.
export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/');
  }

  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Reading the wallet is what applies an owed 24h top-up.
  const wallet = await getNotesWallet();
  const daily = wallet?.daily_notes_balance ?? 0;
  const premium = wallet?.premium_notes_balance ?? 0;
  const full = daily >= DAILY_NOTES_ALLOWANCE;

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Your NOTES</span>
        </h1>
        <p className="text-sm text-ink/55">One NOTE buys one comment.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-2 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-semibold text-ink/70">Daily notes</h2>
            <span className="chip">Free</span>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">
            {daily}
            <span className="text-lg font-medium text-ink/35">/{DAILY_NOTES_ALLOWANCE}</span>
          </p>
          {/* Rendered client-side: the countdown ticks, and a server-rendered
              value would be stale the moment it reached the browser. */}
          <DailyResetCountdown nextResetAt={wallet?.next_reset_at ?? null} full={full} />
        </div>

        <div className="card space-y-2 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-sm font-semibold text-ink/70">Premium notes</h2>
            <span className="rounded-full border border-lilac-200 bg-lilac-50 px-3 py-1 text-xs font-semibold text-lilac-400">
              Bought
            </span>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{premium}</p>
          <p className="text-xs text-ink/45">
            {premium > 0
              ? 'These never expire, and comments posted with one stand out.'
              : 'No premium notes yet — they never expire once bought.'}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-semibold">Earn a note</h2>
        <VideoAdSlot />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Buy premium notes</h2>
          <p className="text-sm text-ink/55">
            Premium notes never expire and give your comments a nicer border.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3">
          {NOTE_PACKAGES.map((pkg) => (
            <li key={pkg.id}>
              <Link
                href={`/checkout?package=${pkg.id}`}
                className={`card card-hover flex h-full flex-col items-center gap-1 p-5 text-center ${
                  pkg.popular ? 'border-blush-300' : ''
                }`}
              >
                {pkg.popular ? <span className="chip mb-1">Most popular</span> : null}
                <span className="font-display text-2xl font-bold tabular-nums">{pkg.notes}</span>
                <span className="text-xs text-ink/50">premium notes</span>
                <span className="mt-1 font-display text-sm font-semibold text-blush-500">
                  {pkg.price}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-center text-[11px] text-ink/40">
          Payments aren&apos;t live yet — checkout is a preview.
        </p>
      </section>

      <p className="text-center text-sm">
        <Link href="/" className="text-ink/50 underline transition hover:text-ink">
          Back to finding cats
        </Link>
      </p>
    </div>
  );
}
