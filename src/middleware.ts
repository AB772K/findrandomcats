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
  let user = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    /* Treated as signed out; the bad cookie is already being expired. */
  }

  // A signed-in account with no nickname yet has to pick one before anything
  // else. Enforced here rather than page by page so it covers every route,
  // including ones added later that would be easy to forget.
  //
  // It costs one indexed lookup, and only on paths where a redirect could
  // actually apply -- never for signed-out visitors, and never on the pages
  // needed to get through or out of the gate, which would otherwise loop.
  if (user && needsNicknameGate(request.nextUrl.pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    // Only a profile that exists and is unnamed is redirected. A missing row
    // means the signup trigger has not landed yet; sending them to a page that
    // cannot save would be worse than letting the request through.
    if (profile && !profile.display_name) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      const gate = NextResponse.redirect(url);
      for (const cookie of response.cookies.getAll()) gate.cookies.set(cookie);
      for (const name of dropped) gate.cookies.delete(name);
      return gate;
    }
  }

  // Expire the debris last, so a refresh written above is never overwritten.
  for (const name of dropped) response.cookies.delete(name);

  return response;
}

/**
 * Paths exempt from the nickname gate: the gate itself, everything that gets
 * you signed in or out, and the Server Action endpoint the form posts to --
 * redirecting a POST would swallow the save and strand the user on the gate.
 */
function needsNicknameGate(pathname: string): boolean {
  return !(
    pathname === '/onboarding' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/')
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
