/**
 * Guards against an auth cookie the Supabase client cannot read.
 *
 * @supabase/ssr stores the session in `sb-<ref>-auth-token`, split into
 * `.0`, `.1`, ... chunks once it passes 3180 bytes. If what comes back does not
 * decode, the client does not report a missing session -- it throws "Invalid
 * UTF-8 sequence" out of its base64url decoder. That escapes the root layout
 * and 500s every page, and it throws again from an unawaited background refresh
 * where no try/catch around getUser() can reach it, so the process itself sees
 * an unhandledRejection.
 *
 * Nothing clears the offending cookie either, so the browser keeps sending it
 * and every reload fails the same way. That is not a recoverable state for a
 * user; a half-written cookie is exactly the debris the earlier chunked-cookie
 * bug left behind, so real browsers are still carrying them.
 *
 * The cure is to never hand the client a cookie it cannot read: filter them on
 * the way in, and let the caller expire what was dropped.
 */

type Cookie = { name: string; value: string };

const AUTH_COOKIE = /^(sb-.*-auth-token)(?:\.(\d+))?$/;

/** Whether a reassembled cookie value is a session this client could use. */
function readable(value: string): boolean {
  try {
    const raw = value.startsWith('base64-')
      ? Buffer.from(value.slice('base64-'.length), 'base64url').toString('utf8')
      : value;
    const parsed = JSON.parse(raw);
    return Boolean(parsed) && typeof parsed === 'object' && 'access_token' in parsed;
  } catch {
    return false;
  }
}

/**
 * Splits the incoming cookies into the ones safe to pass on and the names of
 * any auth cookies that should be expired.
 *
 * Chunks are only meaningful joined, so a base name is judged as a whole: if
 * the reassembled value is unreadable, every cookie belonging to it goes.
 */
export function sanitizeAuthCookies(all: Cookie[]): { cookies: Cookie[]; dropped: string[] } {
  const groups = new Map<string, { name: string; index: number; value: string }[]>();

  for (const { name, value } of all) {
    const match = AUTH_COOKIE.exec(name);
    if (!match) continue;
    const base = match[1];
    const index = match[2] === undefined ? -1 : Number(match[2]);
    const group = groups.get(base) ?? [];
    group.push({ name, index, value });
    groups.set(base, group);
  }

  const dropped: string[] = [];
  for (const parts of Array.from(groups.values())) {
    // An unchunked cookie is the whole session; otherwise join the chunks in
    // order. A gap in the numbering means the value is truncated either way.
    const whole = parts.find((p) => p.index === -1);
    const chunks = parts.filter((p) => p.index >= 0).sort((a, b) => a.index - b.index);
    const contiguous = chunks.every((p, i) => p.index === i);
    const value = whole ? whole.value : contiguous ? chunks.map((p) => p.value).join('') : '';

    if (!value || !readable(value)) dropped.push(...parts.map((p) => p.name));
  }

  if (dropped.length === 0) return { cookies: all, dropped };
  const gone = new Set(dropped);
  return { cookies: all.filter((c) => !gone.has(c.name)), dropped };
}
