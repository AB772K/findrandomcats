import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { sanitizeAuthCookies } from '@/lib/supabase/cookies';

type CookiesToSet = { name: string; value: string; options: CookieOptions }[];

/**
 * Refreshes the Supabase auth cookie on every navigation so Server Components
 * and Server Actions always see a valid session.
 *
 * The cookie plumbing is shaped the way @supabase/ssr expects: setAll receives
 * every cookie for a refresh at once, and they are all written onto ONE
 * response. The previous version rebuilt the response inside a per-cookie set()
 * callback, so whenever Supabase wrote more than one cookie -- which it does as
 * soon as a session exceeds the 3180-byte chunk threshold, and whenever a
 * session moves between chunked and unchunked -- every cookie but the last was
 * discarded. The client was then left holding a partial session whose refresh
 * token had already been spent, and the next request arrived unauthenticated.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  // An auth cookie the client cannot decode does not read as "no session" -- it
  // throws, and the throw escapes into the root layout and 500s the page. Drop
  // it before the client ever sees it, and expire it below so the browser stops
  // resending it; otherwise every reload fails identically and forever.
  const { cookies: safeCookies, dropped } = sanitizeAuthCookies(request.cookies.getAll());
  for (const name of dropped) request.cookies.delete(name);
  if (dropped.length > 0) response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return safeCookies;
      },
      setAll(cookiesToSet: CookiesToSet) {
        // Make the refreshed cookies visible to this request's own render...
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        // ...and send every one of them on to the browser.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not drop this call: it is what performs the refresh. The catch is a
  // backstop only -- sanitizing above is what actually prevents the throw,
  // including the one raised from an unawaited background refresh that no
  // try/catch here could reach.
  try {
    await supabase.auth.getUser();
  } catch {
    /* Treated as signed out; the bad cookie is already being expired. */
  }

  // Expire the debris last, so a refresh written above is never overwritten.
  for (const name of dropped) response.cookies.delete(name);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
