import Link from 'next/link';
import { redirect } from 'next/navigation';
import CheckoutForm from '@/app/checkout/CheckoutForm';
import { findNotePackage } from '@/lib/notes';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Checkout · FindRandomCats' };

/**
 * Placeholder checkout. No payment processor is wired up: this page renders a
 * summary and a Buy button that reports that payments are not live.
 *
 * When Stripe goes in, the Buy button's action should create a Checkout Session
 * server-side and redirect to it (see startCheckout() in src/lib/actions.ts),
 * with a /checkout/success return URL. Premium notes must be credited by the
 * checkout.session.completed webhook, never here -- a user can reach the return
 * URL without paying.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: { package?: string };
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect('/');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The package is looked up server-side by id -- the price never comes from
  // the query string, which is the habit to keep once real money is involved.
  const pkg = findNotePackage(searchParams.package ?? '');
  if (!pkg) redirect('/notes');

  return (
    <div className="mx-auto max-w-md animate-fade-up space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          <span className="text-blush-500">Checkout</span>
        </h1>
        <p className="text-sm text-ink/55">Review your premium note pack.</p>
      </div>

      <section className="card space-y-4 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold tabular-nums">{pkg.notes} notes</p>
            <p className="text-xs text-ink/50">Premium · never expire</p>
          </div>
          <p className="font-display text-xl font-semibold text-blush-500">{pkg.price}</p>
        </div>

        <dl className="space-y-1.5 border-t border-blush-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/55">Subtotal</dt>
            <dd className="tabular-nums text-ink/75">{pkg.price}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink/55">Tax</dt>
            <dd className="text-ink/45">Calculated at payment</dd>
          </div>
          <div className="flex justify-between border-t border-blush-100 pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{pkg.price}</dd>
          </div>
        </dl>

        <CheckoutForm packageId={pkg.id} />
      </section>

      <p className="text-center text-sm">
        <Link href="/notes" className="text-ink/50 underline transition hover:text-ink">
          Back to your NOTES
        </Link>
      </p>
    </div>
  );
}
