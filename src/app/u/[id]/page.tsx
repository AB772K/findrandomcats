import Link from 'next/link';
import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import DeleteCatButton from '@/components/DeleteCatButton';
import SuccessToast from '@/components/SuccessToast';
import { displayNameOf } from '@/lib/avatar';
import { createClient } from '@/lib/supabase/server';
import { REACTIONS, type Cat, type PublicProfile, type RatingTally, type ReactionTotals } from '@/lib/types';

// Profiles change whenever someone comments, so render per request.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: 'Profile · FindRandomCats', alternates: { canonical: `/u/${params.id}` } };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card card-hover p-4 text-center">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs leading-tight text-ink/50">{label}</p>
    </div>
  );
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { uploaded?: string };
}) {
  if (!UUID.test(params.id)) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    notFound();
  }

  const supabase = createClient();

  // Both of these are security-definer aggregates, exactly like
  // cat_rating_summary(). Nothing here reads profiles or ratings directly, so
  // RLS cannot leak either wallet balance, the email, or which cats they rated.
  // Lifetime spend is public; what is left in the wallet is not.
  // Uploads are the exception: `cats` is world-readable by policy, so the grid
  // needs no aggregate wrapper -- and uploaded_by already holds a profiles.id,
  // never a user_id.
  const [profileResult, ratingsResult, uploadsResult, reactionsResult, viewer] = await Promise.all([
    supabase.rpc('public_profile', { p_profile_id: params.id }),
    supabase.rpc('profile_rating_summary', { p_profile_id: params.id }),
    supabase
      .from('cats')
      .select('*')
      .eq('uploaded_by', params.id)
      .eq('source_type', 'user_upload')
      .order('created_at', { ascending: false })
      .limit(60),
    // Aggregate totals only -- never which comment earned what.
    supabase.rpc('profile_reaction_totals', { p_profile_id: params.id }),
    supabase.auth.getUser(),
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

  const uploads = (uploadsResult.data ?? []) as Cat[];
  const name = displayNameOf(profile.display_name);

  const totals = ((reactionsResult.data as ReactionTotals[] | null)?.[0] ?? {
    likes: 0,
    funny: 0,
    loves: 0,
    dislikes: 0,
  }) as ReactionTotals;
  const totalFor: Record<string, number> = {
    like: Number(totals.likes),
    funny: Number(totals.funny),
    love: Number(totals.loves),
    dislike: Number(totals.dislikes),
  };

  // The delete control only renders for the uploader. delete_cat() checks
  // ownership itself, so this is presentation rather than enforcement.
  const viewerId = viewer.data.user?.id ?? null;
  let isOwner = false;
  if (viewerId) {
    const { data: mine } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', viewerId)
      .maybeSingle();
    isOwner = mine?.id === profile.id;
  }

  return (
    <div className="animate-fade-up space-y-6">
      {/* Carried across the redirect from uploadCat() so the confirmation lands
          on the page that now shows the new cat. */}
      {searchParams.uploaded ? (
        <SuccessToast key={searchParams.uploaded} message="Cat added!" />
      ) : null}

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

      <section className="card p-5">
        <h2 className="mb-3 font-display text-base font-semibold">Reactions received</h2>
        <div className="grid grid-cols-4 gap-2">
          {REACTIONS.map(({ kind, emoji, label }) => (
            <div key={kind} className="rounded-2xl border border-blush-100 bg-blush-50/50 p-3 text-center">
              <div aria-hidden className="text-xl leading-none">{emoji}</div>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-ink">
                {totalFor[kind].toLocaleString()}
              </p>
              <p className="text-[11px] text-ink/50">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={Number(profile.comment_count)} label="comments written" />
        <Stat value={Number(profile.daily_notes_spent)} label="notes spent" />
        <Stat value={Number(profile.premium_notes_spent)} label="premium notes spent" />
        <Stat value={average === null ? '—' : `${average.toFixed(1)}/10`} label="average given" />
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Cats Uploaded</h2>
          <span className="text-xs text-ink/45">
            {uploads.length} {uploads.length === 1 ? 'cat' : 'cats'}
          </span>
        </div>

        {uploads.length === 0 ? (
          <p className="text-sm text-ink/45">They have not uploaded a cat yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {uploads.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/c/${cat.id}`}
                  title={cat.caption ?? 'A cat'}
                  className="group relative block aspect-square overflow-hidden rounded-xl bg-lilac-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cat.image_url}
                    alt={cat.caption ?? 'A cat'}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 py-1 text-[10px] font-medium text-white opacity-0 transition duration-200 group-hover:opacity-100">
                    {cat.view_count.toLocaleString()} views
                  </span>
                </Link>
                {isOwner ? (
                  <div className="mt-1 text-center">
                    <DeleteCatButton catId={cat.id} compact />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
                        className="block h-full rounded-full bg-blush-300 transition-[width] duration-500"
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
