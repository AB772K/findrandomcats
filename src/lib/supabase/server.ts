import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { sanitizeAuthCookies } from '@/lib/supabase/cookies';

type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

/**
 * Server-side Supabase client.
 *
 * Uses the getAll/setAll cookie API rather than the deprecated get/set/remove
 * one. That matters for correctness, not just deprecation: when a session is
 * refreshed, @supabase/ssr hands back every cookie it wants written in a single
 * setAll call. Writing them one at a time makes it possible to persist some and
 * drop others, which leaves a half-written session on the client -- and because
 * Supabase refresh tokens are single-use, a dropped write means the old token
 * has already been spent and the user is silently logged out on the next
 * request. That is what produced "Sign in to upload a cat." while signed in.
 *
 * Cookie writes still throw in Server Components (Next only permits them from
 * Actions and Route Handlers). That case is swallowed because the middleware
 * has already written the refreshed cookie for us.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        // Never hand the client an auth cookie it cannot decode: it throws
        // rather than reporting a missing session. See sanitizeAuthCookies.
        return sanitizeAuthCookies(cookieStore.getAll()).cookies;
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          /* Server Component render -- middleware handles it. */
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * getUser() does not merely return a null user when the auth cookie is
 * unreadable -- it throws out of the base64url decoder. Uncaught, that escapes
 * whatever Server Component asked, and a single malformed cookie turns into a
 * 500 on every page rather than a signed-out visitor. The middleware clears
 * such a cookie, but every entry point that reads a user gets the same
 * guarantee here so nothing depends on the middleware having run first.
 */
export async function getSessionUser() {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return user;
  } catch {
    return null;
  }
}
