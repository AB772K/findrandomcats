import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Where Google returns the user.
 *
 * Supabase hands back a one-time `code`; exchanging it is what actually creates
 * the session. This is a Route Handler rather than a page for one reason that
 * matters: Next only permits cookie writes from Actions and Route Handlers, so
 * this is somewhere the session cookie can genuinely be set. It goes through
 * the same createClient() as everything else, which means the same getAll/setAll
 * plumbing -- an OAuth session that outgrows 3180 bytes gets chunked and read
 * back exactly like a password one.
 *
 * Anything that goes wrong lands back on /login carrying a readable message,
 * because a redirect has nowhere else to report to.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Where to land once the code is exchanged. Only a same-site path is
  // accepted -- taking an absolute URL from a query param would turn this into
  // an open redirect that arrives carrying a fresh session.
  const requested = searchParams.get('next') ?? '/';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  // Google's own refusals arrive as query params, not as a failed exchange.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(providerError)}`);
  }

  // This route serves Google sign-in AND password recovery, so the wording has
  // to follow the arrival rather than name a provider that was never involved.
  const recovery = next.startsWith('/auth/reset-password');
  if (!code) {
    const message = recovery
      ? 'That reset link is missing its code. Ask for a new one.'
      : 'Google did not send a sign-in code back.';
    return NextResponse.redirect(
      `${origin}${recovery ? next : '/login'}?error=${encodeURIComponent(message)}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // An expired or already-used link fails here. Send a recovery attempt back
    // to the reset page, which can offer a new link, rather than to /login,
    // which can only offer a password they have come here because they forgot.
    const target = recovery ? next : '/login';
    return NextResponse.redirect(
      `${origin}${target}?error=${encodeURIComponent(error.message)}`,
    );
  }

  // A brand-new Google account gets its profile from the same handle_new_user
  // trigger a password signup does, so there is nothing extra to create here.
  //
  // A password recovery link comes through here too, with next pointing at the
  // reset form: the exchange above is what gives that page the session it needs
  // to set a new password, and this is one of the few places Next allows the
  // cookie to be written.
  return NextResponse.redirect(`${origin}${next}`);
}
