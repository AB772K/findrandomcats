import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Server-side Supabase client. Cookie writes are wrapped in try/catch because
 * Next.js forbids them from Server Components (only Actions / Route Handlers) --
 * in that case the middleware refresh has already written the cookie for us.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          /* Server Component render -- middleware handles it. */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          /* Server Component render -- middleware handles it. */
        }
      },
    },
  });
}
