import { cache } from 'react';
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
/** Errors that mean the auth service was unreachable, not that the token was bad. */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number } | null)?.status;
  return (
    /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|socket hang up/i.test(message) ||
    (typeof status === 'number' && status >= 500)
  );
}

export type SessionState = {
  user: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['getUser']>>['data']['user'];
  /**
   * True when the auth service could not be reached even after retrying. The
   * user is null in that case too, but "we could not check" must never be
   * shown as "you are not signed in": one is a retry, the other is a login
   * form, and confusing them is what produced the confusing error.
   */
  unverified: boolean;
  /** True for the one request right after the middleware ended an idle session. */
  expired: boolean;
};

export const SESSION_EXPIRED_MESSAGE =
  'Your session ended after an hour of inactivity. Please sign in again.';

/** Wording for the unverified case, shared so every surface says the same thing. */
export const SESSION_UNVERIFIED_MESSAGE =
  'Could not confirm your session just now. Please try again.';

/**
 * The session, checked ONCE per request.
 *
 * Wrapped in React's cache() so every caller in a single render -- the root
 * layout that draws the nav, the page that decides whether the star picker is
 * enabled, the action that saves the rating -- shares one result. Before this
 * each made its own network call to the auth service, and when one of them
 * failed transiently the page contradicted itself: the nav showed you signed
 * in while the picker said "Sign in to rate this cat." That was the bug
 * reported against new accounts. It was not about new accounts; it was about
 * two calls disagreeing, and a fresh session's first requests are simply when
 * a blip is most visible.
 *
 * Transient failures are retried. If the service still cannot be reached the
 * whole request sees one coherent answer -- no user, flagged unverified -- so
 * nothing on the page can claim otherwise.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // The middleware sets this for one request when it ends an idle session, so
  // an action landing in that request can say "expired" rather than "sign in".
  const expired = cookies().get('fr-expired')?.value === '1';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await createClient().auth.getUser();
      if (!error) return { user: data.user, unverified: false, expired };
      // A definite answer -- no session, expired, bad token -- is not transient.
      if (!isTransient(error)) return { user: null, unverified: false, expired };
    } catch (error) {
      // An undecodable cookie throws; that is a real absence of a usable
      // session, and the middleware is already expiring it.
      if (!isTransient(error)) return { user: null, unverified: false, expired };
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  return { user: null, unverified: true, expired };
});

/** The signed-in user, or null. See getSessionState() for what null can mean. */
export async function getSessionUser() {
  return (await getSessionState()).user;
}

/**
 * A client that reads and writes no cookies at all.
 *
 * For checking a password without becoming signed in as a side effect: a
 * sign-in attempt on the request's own client would rewrite the session cookies
 * mid-request, so a wrong guess would sign the user out of the page they are
 * standing on, and a right one would pointlessly rotate their session.
 */
export function createStatelessClient() {
  return createServerClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
