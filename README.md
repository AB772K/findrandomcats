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
   `cat-photos` storage bucket, and the signup trigger that grants 3 NOTES.

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
| Comments cost 1 NOTE | `post_comment()` SQL function — balance check, debit, and insert in one transaction |
| Ad slot every 2 cats | `CATS_PER_AD` in [`src/components/CatFeed.tsx`](src/components/CatFeed.tsx), rendering [`AdSlot`](src/components/AdSlot.tsx) |
| Adblock nudge | [`src/components/AdblockNotice.tsx`](src/components/AdblockNotice.tsx) |
| Attribution per source | [`src/components/CatImage.tsx`](src/components/CatImage.tsx) |
| User uploads | [`src/app/upload/`](src/app/upload/) → `cat-photos` bucket |

### Privacy of ratings

`ratings` has no public SELECT policy — a signed-in user can read only their own
row. Everyone else's stars are reachable only through the `security definer`
`cat_rating_summary()` function, which returns counts and percentages, never
user ids.

### Wiring up AdSense later

`AdSlot` renders `<div id="ad-slot">`. Once approved, drop the AdSense script
into `src/app/layout.tsx` and replace the placeholder markup with your
`<ins className="adsbygoogle">` unit. `AdblockNotice` already probes for a
blocked `.adsbygoogle` element, so it keeps working unchanged.

## Deploying

Push to GitHub, import the repo on Vercel, and set `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
