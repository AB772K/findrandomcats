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
| Premium comment styling | `used_premium_note` on `comments`, set inside `post_comment()`; rendered by [`CommentBox`](src/components/CommentBox.tsx) |
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

## Deploying

Push to GitHub, import the repo on Vercel, and set `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
