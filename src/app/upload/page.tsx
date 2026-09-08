import Link from 'next/link';
import { redirect } from 'next/navigation';
import UploadForm from '@/app/upload/UploadForm';
import SuccessToast from '@/components/SuccessToast';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Upload a cat · FindRandomCats' };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: { uploaded?: string };
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="mx-auto max-w-md animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Add your cat</span>
        </h1>
        <p className="text-sm text-ink/55">
          It joins the random pool right away. Uploads carry no attribution line.
        </p>
      </div>

      {/* keyed on the redirect's timestamp so two uploads in a row each get
          their own toast rather than React reusing a faded-out one */}
      {searchParams.uploaded ? (
        <>
          <SuccessToast key={searchParams.uploaded} message="Cat added!" />
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
            Your cat is in the pool —{' '}
            <Link href="/" className="font-semibold underline">
              go find some cats
            </Link>
            .
          </p>
        </>
      ) : null}

      <UploadForm />
    </div>
  );
}
