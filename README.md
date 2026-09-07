# FindRandomCats

Find a random cat, rate it 1–10, and argue about it in the comments. Next.js 14
(App Router) + Supabase + Tailwind, sized for the Vercel free tier.

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the dashboard SQL editor. It creates the tables, the RLS policies, the
   `cat-photos` and `avatars` storage buckets, and the signup trigger that
   grants 3 NOTES. The script is idempotent — re-run it after pulling to pick up
   new columns and functions.

3. **Add credentials**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
   *Project Settings → API*. `SUPABASE_SERVICE_ROLE_KEY` is only needed for the
   seed script — never ship it to the browser.

4. **Seed ~20 cats** from The Cat API

   ```bash
   npm run seed
   ```

5. **Run it**

   ```bash
   npm run dev
   ```

   For local signup without email round-trips, turn off *Authentication →
   Sign In / Providers → Confirm email* in the Supabase dashboard.

## How the pieces fit

| Feature | Where |
| --- | --- |
| Random cat + aggregates | `random_cat()` / `cat_rating_summary()` in `supabase/schema.sql`, called from [`src/lib/actions.ts`](src/lib/actions.ts) |
| Rating (1–10, one per user per cat) | `ratings` unique constraint + upsert in `rateCat()` |
| Comments cost 1 NOTE | `post_comment()` SQL function — picks the wallet, debits it, and inserts in one transaction |
| Daily / premium wallets | `daily_notes_balance` + `premium_notes_balance` on `profiles`; read via `my_notes()`, topped up by `refresh_daily_notes()` |
| Notes balance + shop | [`src/app/notes/`](src/app/notes/) |
| Checkout (placeholder) | [`src/app/checkout/`](src/app/checkout/) — no processor wired up |
| Profanity check on comments | [`src/lib/profanity.ts`](src/lib/profanity.ts) (`bad-words`), called from `postComment()` — rejects, never censors |
| Comment avatars + names | `cat_comments()` SQL function joins each author's public profile fields; rendered by [`Avatar`](src/components/Avatar.tsx) |
| Public profiles | [`src/app/u/[id]/`](src/app/u/) via `public_profile()` / `profile_rating_summary()` |
| Premium comment styling | `used_premium_note` on `comments`, set inside `post_comment()`; rendered by [`CommentItem`](src/components/CommentItem.tsx) |
| Edit / delete your comment | 10-minute window: `edit_comment()` / `delete_comment()` plus the `comments` delete policy |
| Cat detection on upload | [`src/lib/cat-detector.ts`](src/lib/cat-detector.ts) — MobileNet, runs locally, no API key |
| A cat's own page | [`src/app/c/[id]/`](src/app/c/) — reached from a profile's upload grid |
| View counts | `cats.view_count`, incremented inside `random_cat()` / `random_commented_cat()` |
| Commented cats back in rotation | `random_commented_cat()`; `FRESH_CATS_PER_COMMENTED` in [`CatFeed`](src/components/CatFeed.tsx) |
| Unique display names | `profiles_display_name_lower_key` index + the `unique_violation` catch in `update_my_profile()` |
| Profile editing | [`src/app/settings/`](src/app/settings/) → `avatars` bucket + `update_my_profile()` |
| Ad slot every 2 cats | `CATS_PER_AD` in [`src/components/CatFeed.tsx`](src/components/CatFeed.tsx), rendering [`AdSlot`](src/components/AdSlot.tsx) |
| Rewarded video placeholder | `CATS_PER_VIDEO_AD` in `CatFeed`, rendering [`VideoAdSlot`](src/components/VideoAdSlot.tsx) (inert, "Coming soon") |
| Adblock nudge | [`src/components/AdblockNotice.tsx`](src/components/AdblockNotice.tsx) |
| Attribution per source | [`src/components/CatImage.tsx`](src/components/CatImage.tsx) |
| User uploads | [`src/app/upload/`](src/app/upload/) → `cat-photos` bucket |

### Privacy of ratings and profiles

`ratings` has no public SELECT policy — a signed-in user can read only their own
row. Everyone else's stars are reachable only through the `security definer`
`cat_rating_summary()` function, which returns counts and percentages, never
user ids.

Public profiles follow the same rule. `/u/[id]` reads nothing directly: both
`public_profile()` and `profile_rating_summary()` are `security definer`
aggregates that hand back a fixed set of columns. Deliberately *not* returned:
`notes_balance`, `user_id`, the account email, and any per-cat rating rows — so
the star breakdown can never be mapped back to a specific cat.

`daily_notes_spent` and `premium_notes_spent` are counters incremented inside
`post_comment()`, which is why the page can show lifetime spend without exposing
either current balance.

### Comment edit window

A comment can be edited or deleted for 10 minutes after posting. The window is
enforced in the database, not by hiding a button: the `comments` delete policy
carries the same `created_at > now() - comment_edit_window()` test, so a direct
PostgREST delete of an older comment matches zero rows, and `edit_comment()`
re-checks both ownership and age. `comment_edit_window()` is a single SQL
function so the policy, both mutation functions, and the countdown the UI shows
can never drift apart.

Editing never moves a NOTE. The NOTE bought the comment, not its wording — and
deleting does not refund, or post-then-delete would be a way to comment free.

### Cat detection on upload

Uploads are classified with MobileNet before anything is written, so a rejected
photo leaves nothing behind in the bucket. ImageNet has no single "cat" class,
so the confidence of every cat class (`tabby`, `Egyptian cat`, `lynx`, …) is
summed and compared against 0.15 — the labels are matched as specific phrases
rather than the substring "cat", because ImageNet also contains "Madagascar cat"
(a lemur) and "cat bear" (a red panda).

A single 224x224 look at the whole frame misses cats that are small or off
centre — a cat on a wall across a garden classifies as "pedestal". The image is
therefore scanned as up to seven views (centre crop, whole frame letterboxed,
then five overlapping 60% tiles) and the best score wins. Views are ordered by
payoff and the scan stops as soon as one clears the threshold, so an ordinary
cat portrait costs a single pass.

If detection cannot reach a verdict — model unreachable, unreadable image,
timeout — the upload is **rejected**, not waved through.

**Performance.** This runs on the pure-JavaScript tfjs CPU backend, at roughly
2.3s per view: a typical cat accepts in ~2.5s, and a rejection pays for the full
scan at ~17s. `@tensorflow/tfjs-node` is about ten times faster, but it needs a
native addon that has no prebuilt Windows binary for 4.22.0. On a Linux
deployment, `npm i @tensorflow/tfjs-node` and repointing the `tf` import at the
top of `cat-detector.ts` is the only change needed. Note that a full scan can
exceed a 10s serverless function limit, so give the upload route enough headroom
(or run detection natively).

### The two wallets

Daily notes top back up to 3 once 24h has passed since `daily_notes_reset_at`.
The top-up is applied lazily by `refresh_daily_notes()` — there is no cron job;
reading your own wallet through `my_notes()` (which the layout does on every
page) is what grants it. The top-up is a conditional `UPDATE` guarded on the
timestamp, so two concurrent requests cannot both hand out an allowance, and it
uses `greatest()` so it never removes notes you already hold.

Premium notes are bought and never expire. Nothing in the schema increments
`premium_notes_balance`: any function callable by the client would be free
money. When a processor is added, the credit belongs in a webhook handler
running with the service-role key, keyed on the payment intent id so a replayed
webhook cannot pay out twice.

`post_comment()` charges the wallet the caller asked for. Falling back from
premium to daily is silent because it costs the user nothing; the reverse is a
hard error, since spending a purchased note without being asked is spending real
money. Only when both wallets are empty is the comment rejected outright.

### Wiring up AdSense later

`AdSlot` renders `<div id="ad-slot">`. Once approved, drop the AdSense script
into `src/app/layout.tsx` and replace the placeholder markup with your
`<ins className="adsbygoogle">` unit. `AdblockNotice` already probes for a
blocked `.adsbygoogle` element, so it keeps working unchanged.

`VideoAdSlot` is the rewarded-video equivalent (shown in the feed and on
`/notes`) and is entirely inert — no SDK call, no NOTE grant. To go live, swap its disabled button for one that opens the
provider's ad and, on the completion callback, calls a new server action that
credits `notes_balance`. Grant the NOTE server-side from the provider's
verification webhook, not from the browser callback, or it is trivially farmed.

### Auth cookies

The middleware and the server client both use @supabase/ssr's `getAll`/`setAll`
cookie API. This is a correctness requirement, not tidiness: a refresh hands
back every cookie to write in one `setAll` call, and the older per-cookie `set`
pattern rebuilt the response inside the callback, so every cookie but the last
was dropped. Because Supabase refresh tokens are single-use, a dropped write
means the old token has already been spent and the user is silently logged out
on their next request — which is what produced "Sign in to upload a cat." while
signed in.

`serverActions.bodySizeLimit` is raised to 6 MB in `next.config.mjs`. The
default is 1 MB, which the 5 MB the upload form advertises would otherwise blow
straight through.

## Deploying

Push to GitHub, import the repo on Vercel, and set `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
