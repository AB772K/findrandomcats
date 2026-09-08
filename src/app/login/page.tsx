import AuthForm from '@/app/login/AuthForm';
import { getSessionUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Sign in · FindRandomCats' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const user = await getSessionUser();
    if (user) redirect('/');
  }

  return (
    <div className="mx-auto max-w-sm animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Welcome in</span>
        </h1>
        <p className="text-sm text-ink/55">New accounts start with 3 NOTES.</p>
      </div>
      {/* Google sends its failures back here as a query param, because the
          callback is a redirect with nowhere else to put them. */}
      {searchParams.error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-center text-xs text-rose-700">
          {searchParams.error}
        </p>
      ) : null}

      <AuthForm />
    </div>
  );
}
