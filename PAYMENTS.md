# Planned payment integration: Lemon Squeezy

**Not yet implemented.** `/checkout` is a placeholder UI only: `startCheckout()`
in [`src/lib/actions.ts`](src/lib/actions.ts) validates the package and the
session, then returns "Payments aren't live yet". No money moves anywhere in
this codebase today. This file exists so the next session does not have to
reconstruct the decision or the plan.

## Provider

[Lemon Squeezy](https://www.lemonsqueezy.com/), chosen because:

- Stripe and 2Checkout do not support individual sellers in Pakistan.
- Lemon Squeezy's own documentation lists Pakistan as a supported country for
  bank payouts in USD.
- It is a Merchant of Record, so it also handles global tax compliance (VAT,
  sales tax) rather than leaving that to us.

## Price tiers (premium NOTES)

| Price | Premium NOTES |
| ----- | ------------- |
| $5    | 100           |
| $15   | 350           |
| $25   | 650           |

`NOTE_PACKAGES` in [`src/lib/notes.ts`](src/lib/notes.ts) already shows these
three (ids `100`, `350`, `650`); the `/notes` and `/checkout` pages read from
it, and prices are never taken from the client. Only the display is done --
buying still returns "payments aren't live yet".

## Integration plan

1. **Hosted checkout** — Lemon.js overlay or plain checkout URLs. Pass the
   buyer's **`profiles.id`** (not the auth `user_id`, and never an email) via
   Lemon Squeezy's custom data parameter (`checkout[custom][profile_id]`), so
   the webhook knows whom to credit without trusting anything the browser
   sends. Sign-in is still required before the checkout opens, exactly as
   `startCheckout()` requires now.
2. **Webhook endpoint** (a Route Handler, e.g. `src/app/api/webhooks/lemonsqueezy/route.ts`):
   - Verify the **HMAC-SHA256 signature** in the `X-Signature` header against
     the raw request body using the webhook signing secret. Reject anything
     that does not verify before parsing.
   - Listen for the **`order_created`** event with status `paid` (Lemon
     Squeezy's "order completed" case).
   - Map the purchased **product variant id** to a tier from the table above
     and credit `profiles.premium_notes_balance` by that many NOTES. Do the
     credit in a security-definer SQL function that only the webhook's
     service-role client can call — regular users have no write access to
     `profiles` (see the RLS audit notes in [`supabase/schema.sql`](supabase/schema.sql))
     and that must stay true.
   - Record the credit in a ledger row alongside the existing NOTES ledgers, so
     a purchase can be reversed the same way a payout can.
3. **Idempotent** on Lemon Squeezy's **order id / event id**: store the id with
   the ledger row under a unique constraint and `ON CONFLICT DO NOTHING`, so a
   redelivered webhook cannot credit twice. Same pattern as the monthly
   settlement.
4. **Test Mode first.** Build and verify the whole flow against Lemon
   Squeezy's test-mode store and test cards, then switch the env vars to the
   live store's credentials. Do not mix: test webhooks must not be able to
   credit a live database.

## Required environment variables (not yet set)

None of these exist in `.env.local` or on the host yet. Create the store and
the three products in the Lemon Squeezy dashboard first, then set:

| Variable                          | What it is                                        |
| --------------------------------- | ------------------------------------------------- |
| `LEMONSQUEEZY_STORE_ID`           | The store's numeric id                            |
| `LEMONSQUEEZY_API_KEY`            | API key, server-side only, never `NEXT_PUBLIC_`   |
| `LEMONSQUEEZY_WEBHOOK_SECRET`     | Signing secret for the webhook endpoint           |
| `LEMONSQUEEZY_VARIANT_100`        | Variant id of the $5 / 100-NOTES product          |
| `LEMONSQUEEZY_VARIANT_350`        | Variant id of the $15 / 350-NOTES product         |
| `LEMONSQUEEZY_VARIANT_650`        | Variant id of the $25 / 650-NOTES product         |

Test-mode and live-mode values differ for every one of these; keep them as
separate environments on the host rather than editing values in place.

## Not in scope of this note

The actual integration. The app is being deployed first with the placeholder
checkout in place; this file is the plan, not the work.
