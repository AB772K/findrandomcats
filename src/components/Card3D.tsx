'use client';

import { useRef, useState, type ReactNode } from 'react';

/**
 * A card that lives in 3D.
 *
 * Hovering tilts it toward the pointer, the way a physical card catches the
 * light when you angle it. Dragging rotates it freely, and a plain click flips
 * it, so the back can be reached on a touch screen where there is no hover.
 * Both faces are real elements with backface-visibility hidden, so the back is
 * genuinely on the back rather than a swapped image.
 *
 * All of it is CSS transforms on two divs. No 3D engine: the thing being
 * imitated is a card in a hand, not a scene, and perspective + rotateX/rotateY
 * do that faithfully at zero cost while nobody is touching it.
 *
 * Rotation is kept after a drag ends, so a badge dragged round to its back
 * stays showing its back until the user moves it again.
 */
export default function Card3D({
  front,
  back,
  width = 190,
  height = 250,
  glow,
  className = '',
  label,
}: {
  front: ReactNode;
  /** Omit for a card with nothing on the back; it then never flips. */
  back?: ReactNode;
  width?: number;
  height?: number;
  /** A box-shadow colour for the resting glow, e.g. the tier's neon. */
  glow?: string;
  className?: string;
  /** Accessible name for the whole card. */
  label: string;
}) {
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const base = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  function tiltToward(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    // ±14° reads as depth; beyond that the text starts to skew more than tilt.
    setRot({ x: base.current.x - py * 14, y: base.current.y + px * 14 });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      // Half a degree per pixel: a full turn in a comfortable wrist-width drag.
      setRot({ x: base.current.x - dy * 0.5, y: base.current.y + dx * 0.5 });
      return;
    }
    tiltToward(event);
  }

  function onPointerUp() {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (moved) {
      // Keep where it was left.
      base.current = rot;
    } else if (back) {
      // A tap, not a drag: flip.
      base.current = { x: 0, y: base.current.y + 180 };
      setRot(base.current);
    }
  }

  function onPointerLeave() {
    if (drag.current) onPointerUp();
    else setRot(base.current);
  }

  // Which face is toward the viewer, for aria and for the pointer-events swap.
  const facingBack = Boolean(back) && Math.abs(((rot.y % 360) + 360) % 360 - 180) < 90;

  return (
    <div
      role={back ? 'button' : 'img'}
      aria-label={label}
      tabIndex={back ? 0 : undefined}
      onKeyDown={(event) => {
        if (back && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          base.current = { x: 0, y: base.current.y + 180 };
          setRot(base.current);
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{ width, height, perspective: 900, touchAction: 'none' }}
      className={`select-none ${back ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
          transition: dragging ? 'none' : 'transform 160ms ease-out',
          filter: glow ? `drop-shadow(0 0 14px ${glow})` : undefined,
        }}
        className="relative"
      >
        <div
          aria-hidden={facingBack}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className="absolute inset-0"
        >
          {front}
        </div>
        {back ? (
          <div
            aria-hidden={!facingBack}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            className="absolute inset-0"
          >
            {back}
          </div>
        ) : null}
      </div>
    </div>
  );
}
