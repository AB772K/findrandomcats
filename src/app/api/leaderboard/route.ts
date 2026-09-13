import { NextResponse, type NextRequest } from 'next/server';
import { fetchLeaderboard } from '@/lib/actions';
import type { LeaderboardMetric, LeaderboardScope } from '@/lib/types';

const METRICS: LeaderboardMetric[] = [
  'likes', 'funny', 'loves', 'dislikes', 'daily_notes_spent', 'premium_notes_spent',
];

/**
 * What the leaderboard poll calls, every ten seconds while its tab is visible.
 *
 * A GET route rather than the Server Action the tabs use, for one reason: the
 * middleware treats /api/leaderboard as PASSIVE, so polling neither extends nor
 * ends the idle timeout. Through the action it would count as activity, and a
 * tab left open on the leaderboard would keep a session alive indefinitely.
 * Clicking a tab still goes through the action and still counts.
 *
 * Same security-definer function underneath as everything else; nothing new is
 * exposed. Never cached: the point is that it moves.
 */
export async function GET(request: NextRequest) {
  const metric = request.nextUrl.searchParams.get('metric') as LeaderboardMetric | null;
  const scope = request.nextUrl.searchParams.get('scope') as LeaderboardScope | null;
  if (!metric || !METRICS.includes(metric) || (scope !== 'monthly' && scope !== 'all-time')) {
    return NextResponse.json({ error: 'Unknown leaderboard.' }, { status: 400 });
  }
  const rows = await fetchLeaderboard(metric, scope);
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}
