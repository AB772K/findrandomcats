import Link from 'next/link';
import LeaderboardTabs from '@/app/leaderboard/LeaderboardTabs';
import { fetchLeaderboard } from '@/lib/actions';

export const metadata = { title: 'Leaderboard · FindRandomCats' };

// Rankings move whenever anyone reacts or comments, so never cache the page.
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <p className="card p-6 text-sm text-ink/60">Leaderboards need Supabase configured first.</p>
    );
  }

  // Only the first board is fetched on the server; the rest load on demand when
  // a tab is picked, so opening the page is one query rather than six.
  // Monthly opens first: it is the board with something at stake.
  const rows = await fetchLeaderboard('likes', 'monthly');

  return (
    <div className="mx-auto max-w-xl animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Leaderboard</span>
        </h1>
        <p className="text-sm text-ink/55">
          Who the cat people rate — this month, and for all time.
        </p>
      </div>

      <LeaderboardTabs initialScope="monthly" initialMetric="likes" initialRows={rows} />

      <p className="text-center text-xs text-ink/40">
        Rankings are aggregate only — names, avatars and one number each.
      </p>

      <p className="text-center text-sm">
        <Link href="/" className="text-ink/50 underline transition hover:text-ink">
          Back to finding cats
        </Link>
      </p>
    </div>
  );
}
