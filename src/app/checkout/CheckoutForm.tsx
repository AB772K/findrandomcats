'use client';

import { useState } from 'react';
import { startCheckout } from '@/lib/actions';

export default function CheckoutForm({ packageId }: { packageId: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);

    // Today this always comes back with the "not live" notice. Once a processor
    // is wired up, startCheckout() will redirect instead of returning.
    const result = await startCheckout(packageId);
    setBusy(false);
    setNotice(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Checking…' : 'Buy notes'}
      </button>

      {notice ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {notice}
        </p>
      ) : null}

      <p className="text-center text-[11px] text-ink/40">
        No card is collected and nothing is charged.
      </p>
    </form>
  );
}
