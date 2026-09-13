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

  // IDLE TIMEOUT. Checked before the refresh below, because refreshing is what
  // would otherwise keep an abandoned session alive forever: Supabase refresh
  // tokens do not expire on their own, so "idle for an hour" has to be this
  // file's rule. A request arriving more than IDLE_LIMIT_MS after the last
  // active one ends the session, whatever the tokens say; every active request
  // inside the limit pushes the deadline out again, so genuine use never hits
  // a hard cutoff. Passive requests -- the leaderboard poll -- neither extend
  // nor end anything.
  const hasSession = safeCookies.some((c) => /^sb-.*-auth-token/.test(c.name));
  const lastActive = Number(request.cookies.get(LAST_ACTIVE_COOKIE)?.value ?? 0);
  const passive = isPassive(request);

  if (hasSession && lastActive > 0 && Date.now() - lastActive > IDLE_LIMIT_MS && !passive) {
    const names = sessionCookieNames(request);
    for (const name of names) request.cookies.delete(name);

    const isNavigation = request.method === 'GET' && !request.headers.get('next-action');
    let out: NextResponse;
    if (isNavigation) {
      // A page load: send them to sign in, with the reason on the page.
      const to = request.nextUrl.clone();
      to.pathname = '/login';
      to.search = '?error=' + encodeURIComponent(
        'Your session ended after an hour of inactivity. Please sign in again.');
      out = NextResponse.redirect(to);
    } else {
      // A Server Action or API call: let it run signed-out. The action reads
      // EXPIRED_COOKIE through getSessionState() and answers with the same
      // sentence instead of a bare "sign in".
      out = NextResponse.next({ request });
    }
    for (const name of names) out.cookies.delete(name);
    out.cookies.set(EXPIRED_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 });
    return out;
  }

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
      if (!passive) {
        gate.cookies.set(LAST_ACTIVE_COOKIE, String(Date.now()), {
          httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
        });
      }
      return gate;
    }
  }

  // Expire the debris last, so a refresh written above is never overwritten.
  for (const name of dropped) response.cookies.delete(name);

  // Stamp activity for a signed-in, non-passive request. The cookie outlives
  // the idle limit on purpose: it has to still be there, old, for the check
  // above to notice how long it has been.
  if (user && !passive) {
    response.cookies.set(LAST_ACTIVE_COOKIE, String(Date.now()), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  }
  // Signing out or in clears the stale stamp; nothing else should carry it.
  if (!user) response.cookies.delete(LAST_ACTIVE_COOKIE);

  return response;
}

/** How long a session may sit untouched before it is ended. */
const IDLE_LIMIT_MS = 60 * 60 * 1000;
/** Records the last request that counted as activity. httpOnly; the browser never reads it. */
const LAST_ACTIVE_COOKIE = 'fr-last-active';
/** Set for one request after an idle expiry, so the next page can say why. */
const EXPIRED_COOKIE = 'fr-expired';

/**
 * Requests that must not count as activity. The leaderboard poll fires every
 * ten seconds while its tab is visible; if that extended the session, a tab
 * left open on the leaderboard would never idle out at all.
 */
function isPassive(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith('/api/leaderboard');
}

/** Every cookie @supabase/ssr may hold a session in, plus this file's own. */
function sessionCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map((c) => c.name)
    .filter((name) => /^sb-.*-auth-token(\.\d+)?$/.test(name) || name === LAST_ACTIVE_COOKIE);
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
