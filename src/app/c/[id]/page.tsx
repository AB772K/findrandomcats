import Link from 'next/link';
import { notFound } from 'next/navigation';
import CatDetail from '@/app/c/[id]/CatDetail';
import CatImage from '@/components/CatImage';
import DeleteCatButton from '@/components/DeleteCatButton';
import RatingBreakdown from '@/components/RatingBreakdown';
import { fetchCat, getNotesWallet } from '@/lib/actions';
import { createClient, getSessionUser } from '@/lib/supabase/server';

// View counts and comments move constantly.
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: 'A cat · FindRandomCats', alternates: { canonical: `/c/${params.id}` } };
}

export default async function CatPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    notFound();
  }

  const supabase = createClient();
  const user = await getSessionUser();

  const bundle = await fetchCat(params.id);
  if (!bundle) notFound();

  const wallet = user ? await getNotesWallet() : null;

  // Uploader-only control. delete_cat() enforces this again server-side.
  let isUploader = false;
  let uploaderId: string | null = null;
  if (user) {
    const { data: mine } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    uploaderId = mine?.id ?? null;
    isUploader = Boolean(mine?.id) && bundle.cat.uploaded_by === mine?.id;
  }

  return (
    <div className="animate-fade-up space-y-6">
      <article className="card space-y-6 p-4 sm:p-6">
        <CatImage cat={bundle.cat} priority />

        {/* Ratings render on the server: this page is reached from a profile
            grid, so it should be readable without JavaScript picking a cat. */}
        <div className="space-y-4 border-t border-lilac-100 pt-5">
          <RatingBreakdown
            tallies={bundle.tallies}
            totalRatings={bundle.totalRatings}
            viewCount={bundle.cat.view_count}
          />
        </div>

        <div className="border-t border-lilac-100 pt-5">
          <CatDetail bundle={bundle} wallet={wallet} signedIn={Boolean(user)} />
        </div>

        {isUploader ? (
          <div className="border-t border-lilac-100 pt-5">
            <DeleteCatButton catId={bundle.cat.id} redirectTo={`/u/${uploaderId}`} />
          </div>
        ) : null}
      </article>

      <p className="text-center text-sm">
        <Link href="/" className="text-ink/50 underline transition hover:text-ink">
          Find a random cat
        </Link>
      </p>
    </div>
  );
}
