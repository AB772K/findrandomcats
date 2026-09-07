'use client';

import { useEffect, useState } from 'react';

/**
 * Bait-element adblock check: blockers hide or strip anything matching their
 * cosmetic filters, so a zero-height .adsbygoogle probe means one is active.
 * This only nudges -- content stays fully accessible either way.
 */
export default function AdblockNotice() {
  const [blocked, setBlocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('frc:adblock-notice-dismissed') === '1') {
      setDismissed(true);
      return;
    }

    const bait = document.createElement('div');
    bait.className = 'adsbygoogle ad-banner ads adsbox';
    bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:5px;height:5px;';
    bait.innerHTML = '&nbsp;';
    document.body.appendChild(bait);

    const timer = window.setTimeout(() => {
      const style = window.getComputedStyle(bait);
      const isBlocked =
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden';

      setBlocked(isBlocked);
      bait.remove();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      bait.remove();
    };
  }, []);

  if (!blocked || dismissed) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3 text-sm">
        <p className="flex-1">
          We noticed an ad blocker — this site runs on ad revenue, please disable it to keep
          finding cats.
        </p>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('frc:adblock-notice-dismissed', '1');
            setDismissed(true);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium underline hover:bg-amber-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
