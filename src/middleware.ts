import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
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

  // Do not drop this call: it is what performs the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
