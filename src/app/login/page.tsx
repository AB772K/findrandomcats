import AuthForm from '@/app/login/AuthForm';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Sign in · FindRandomCats' };

export default async function LoginPage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect('/');
  }

  return (
    <div className="mx-auto max-w-sm animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-blush-400 to-lilac-400 bg-clip-text text-transparent">
            Welcome in
          </span>
        </h1>
        <p className="text-sm text-ink/55">New accounts start with 3 NOTES.</p>
      </div>
      <AuthForm />
    </div>
  );
}
