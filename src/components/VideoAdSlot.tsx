/**
 * Placeholder for a rewarded video ad ("watch a video, earn 1 NOTE").
 *
 * Deliberately inert: AdSense is not approved yet, so there is no SDK call, no
 * NOTE grant and no reward server action behind this. When a provider is wired
 * up, swap the disabled button for one that opens the ad and calls a
 * `claimVideoReward()` action on the provider's completion callback -- the
 * layout and copy here should not need to change.
 */
export default function VideoAdSlot({ reward = 1 }: { reward?: number }) {
  return (
    <div
      id="video-ad-slot"
      data-reward-notes={reward}
      className="card flex flex-col items-center gap-3 border-dashed border-lilac-200 bg-white/50 p-5 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blush-100 to-lilac-100 text-lg">
        ▶
      </span>

      <div className="space-y-1">
        <p className="font-display text-sm font-semibold text-ink/70">
          Watch a video for {reward} NOTE{reward === 1 ? '' : 'S'}
        </p>
        <p className="text-xs text-ink/45">
          Rewarded videos are not live yet — your NOTES still come from signing up.
        </p>
      </div>

      <button
        type="button"
        disabled
        aria-disabled
        title="Rewarded video ads are not available yet"
        className="cursor-not-allowed rounded-full bg-ink/10 px-5 py-2 text-sm font-semibold text-ink/40"
      >
        Watch video
      </button>

      <span className="rounded-full bg-lilac-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
        Coming soon
      </span>
    </div>
  );
}
