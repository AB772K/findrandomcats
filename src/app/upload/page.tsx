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
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Add your cat</h1>
        <p className="text-sm text-ink/60">
          It joins the random pool right away. Uploads carry no attribution line.
        </p>
      </div>

      {searchParams.uploaded ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Uploaded — <Link href="/" className="underline">go find some cats</Link>.
        </p>
      ) : null}

      <UploadForm />
    </div>
  );
}
