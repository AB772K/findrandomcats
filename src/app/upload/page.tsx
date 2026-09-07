import Link from 'next/link';
import { redirect } from 'next/navigation';
import UploadForm from '@/app/upload/UploadForm';
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
          <span className="bg-gradient-to-r from-blush-400 to-lilac-400 bg-clip-text text-transparent">
            Add your cat
          </span>
        </h1>
        <p className="text-sm text-ink/55">
          It joins the random pool right away. Uploads carry no attribution line.
        </p>
      </div>

      {searchParams.uploaded ? (
        <p className="rounded-2xl bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 shadow-soft">
          Uploaded — <Link href="/" className="underline">go find some cats</Link>.
        </p>
      ) : null}

      <UploadForm />
    </div>
  );
}
