/**
 * Placeholder for an AdSense unit. Rendered after every 2 cats viewed; swap the
 * inner markup for the real <ins className="adsbygoogle"> once approved.
 */
export default function AdSlot({ index }: { index: number }) {
  return (
    <div
      id="ad-slot"
      data-ad-index={index}
      className="flex h-28 items-center justify-center rounded-xl border border-dashed border-ink/25 bg-ink/[0.03] text-xs uppercase tracking-widest text-ink/40"
    >
      Ad slot
    </div>
  );
}
