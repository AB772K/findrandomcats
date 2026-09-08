'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A fixed, curated palette -- deliberately not the OS emoji keyboard. Every
 * entry is an everyday face, heart, hand, animal or object with no plausible
 * violent, sexual or insulting reading, so the picker cannot become a way to
 * say something the profanity filter would have blocked in words.
 *
 * The first four match the reaction bar, so the same four symbols mean the same
 * thing whether you tap them or type them.
 */
const EMOJIS = [
  '\u{1F44D}', '❤️', '\u{1F602}', '\u{1F44E}',
  '\u{1F638}', '\u{1F63B}', '\u{1F63A}', '\u{1F639}',
  '\u{1F431}', '\u{1F408}', '\u{1F43E}', '\u{1F415}',
  '\u{1F642}', '\u{1F600}', '\u{1F604}', '\u{1F60A}',
  '\u{1F60D}', '\u{1F929}', '\u{1F970}', '\u{1F917}',
  '\u{1F914}', '\u{1F62E}', '\u{1F62D}', '\u{1F971}',
  '\u{1F60E}', '\u{1F607}', '\u{1F643}', '\u{1F61C}',
  '\u{1F495}', '\u{1F49B}', '\u{1F49C}', '\u{1F49A}',
  '⭐', '✨', '\u{1F31F}', '\u{1F389}',
  '\u{1F44F}', '\u{1F64C}', '\u{1F91D}', '✌️',
];

export default function EmojiPicker({
  onPick,
  disabled,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, the two things people expect from a
  // popover but that nothing gives you for free.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Insert an emoji"
        title="Insert an emoji"
        className="rounded-full border border-blush-100 bg-paper px-2.5 py-1 text-sm transition duration-200 hover:border-lilac-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden>{'\u{1F642}'}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full left-0 z-30 mb-2 w-[17rem] rounded-2xl border border-blush-100 bg-paper p-2 shadow-lift"
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onPick(emoji);
                  setOpen(false);
                }}
                className="rounded-lg p-1 text-lg leading-none transition duration-150 hover:bg-blush-50"
              >
                <span aria-hidden>{emoji}</span>
                <span className="sr-only">{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
