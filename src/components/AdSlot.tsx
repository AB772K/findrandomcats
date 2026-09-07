/**
 * Placeholder for an AdSense unit. Rendered after every 2 cats viewed; swap the
 * inner markup for the real <ins className="adsbygoogle"> once approved.
 */
export default function AdSlot({ index }: { index: number }) {
  return (
    <div
      id="ad-slot"
      data-ad-index={index}
      className="flex h-28 items-center justify-center rounded-3xl border border-dashed border-lilac-200 bg-lilac-50/60 text-xs uppercase tracking-[0.2em] text-ink/35"
    >
      Ad slot
    </div>
  );
}
