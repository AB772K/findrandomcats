import Link from 'next/link';
import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import { displayNameOf } from '@/lib/avatar';
import { createClient } from '@/lib/supabase/server';
import type { PublicProfile, RatingTally } from '@/lib/types';

// Profiles change whenever someone comments, so render per request.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: 'Profile · FindRandomCats', alternates: { canonical: `/u/${params.id}` } };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card card-hover flex-1 p-4 text-center">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}

export default async function PublicProfilePage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    notFound();
  }

  const supabase = createClient();

  // Both of these are security-definer aggregates, exactly like
  // cat_rating_summary(). Nothing here reads profiles or ratings directly, so
  // RLS cannot leak the balance, the email, or which cats they rated.
  const [profileResult, ratingsResult] = await Promise.all([
    supabase.rpc('public_profile', { p_profile_id: params.id }),
    supabase.rpc('profile_rating_summary', { p_profile_id: params.id }),
  ]);

  const profile = (profileResult.data as PublicProfile[] | null)?.[0];
  if (!profile) notFound();

  const tallies = (ratingsResult.data as RatingTally[] | null) ?? [];
  // Highest scores first, so the most generous ratings read at the top.
  const rows = [...tallies].sort((a, b) => b.stars - a.stars);
  const totalRatings = tallies.reduce((sum, t) => sum + Number(t.count), 0);
  const average =
    totalRatings > 0
      ? tallies.reduce((sum, t) => sum + t.stars * Number(t.count), 0) / totalRatings
      : null;

  const name = displayNameOf(profile.display_name);

  return (
    <div className="animate-fade-up space-y-6">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar
            name={profile.display_name}
            url={profile.profile_picture_url}
            seed={profile.id}
            size="lg"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-xs text-ink/45">
              Finding cats since{' '}
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </p>
            {profile.bio ? (
              <p className="whitespace-pre-wrap break-words pt-1 text-sm text-ink/70">
                {profile.bio}
              </p>
            ) : (
              <p className="pt-1 text-sm italic text-ink/35">No bio yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <Stat value={Number(profile.comment_count)} label="comments written" />
        <Stat value={Number(profile.notes_spent)} label="NOTES spent" />
        <Stat value={average === null ? '—' : `${average.toFixed(1)}/10`} label="average given" />
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Ratings they give out</h2>
          <span className="text-xs text-ink/45">
            {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
          </span>
        </div>

        {totalRatings === 0 ? (
          <p className="text-sm text-ink/45">They have not rated a cat yet.</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {rows.map((tally) => {
                const percent = Number(tally.percent);
                return (
                  <li key={tally.stars} className="flex items-center gap-3 text-xs">
                    <span className="w-12 shrink-0 tabular-nums text-ink/55">{tally.stars} ★</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-lilac-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-blush-300 to-lilac-300 transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-32 shrink-0 text-right tabular-nums text-ink/55">
                      {percent}% gave {tally.stars} stars
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-ink/40">
              Aggregate only — which cats they rated stays private.
            </p>
          </>
        )}
      </section>

      <p className="text-center text-sm">
        <Link href="/" className="text-ink/50 underline transition hover:text-ink">
          Back to finding cats
        </Link>
      </p>
    </div>
  );
}
