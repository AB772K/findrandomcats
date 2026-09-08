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

  // Google's own refusals arrive as query params, not as a failed exchange.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(providerError)}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Google did not send a sign-in code back.')}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // A brand-new Google account gets its profile from the same handle_new_user
  // trigger a password signup does, so there is nothing extra to create here.
  return NextResponse.redirect(`${origin}/`);
}
