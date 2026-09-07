function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase credentials.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_ANON_KEY = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
