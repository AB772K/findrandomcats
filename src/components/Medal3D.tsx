'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * A medal, modelled and lit for real.
 *
 * The coin is built in code -- an extruded, bevelled disc with a torus for the
 * raised rim on each face -- so there is no downloaded model and no licence to
 * think about, and every dimension is a number here. The faces are two thin
 * discs carrying textures drawn on a canvas at mount: the rank, metric and
 * month on the front, the holder's name on the back. The same drawing, in
 * greyscale, drives a bump map, which is what makes the lettering catch light
 * along its edges: raised on the front, cut INTO the metal on the back, so the
 * name reads as engraved rather than printed.
 *
 * The metal is a physically based material with full metalness and a low
 * roughness, and a metal is only as convincing as what it reflects, so the
 * scene builds its own environment map from a handful of soft light panels --
 * no HDR fetched from anywhere. A few lights on top give the bevel a specular
 * edge.
 *
 * OrbitControls are limited to rotation: no zoom, no pan. It idles in a slow
 * spin so the depth is obvious before anyone touches it, and stops the moment
 * they do; it resumes a couple of seconds after they let go.
 *
 * Three.js is heavy, so this file is only ever loaded through next/dynamic
 * with ssr off, and only mounted from the inspect view -- never from a list.
 */

export type MedalTier = 1 | 2 | 3;

/** Base colour, roughness and lettering shade per metal. */
const METALS: Record<MedalTier, { color: string; roughness: number; dark: string; light: string; name: string }> = {
  1: { name: 'Gold', color: '#e0ab2e', roughness: 0.26, dark: '#7a4f05', light: '#fff2b3' },
  2: { name: 'Silver', color: '#c9cfd8', roughness: 0.2, dark: '#4b525b', light: '#ffffff' },
  3: { name: 'Bronze', color: '#b7703a', roughness: 0.34, dark: '#4a260d', light: '#ffd9b8' },
};

const ORDINAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

/** Coin dimensions in scene units. Radius 1 keeps the camera maths simple. */
const RADIUS = 1;
const THICKNESS = 0.14;
const RIM_RADIUS = 0.9;
const RIM_TUBE = 0.05;
const FACE_RADIUS = RIM_RADIUS - RIM_TUBE - 0.01;

const TEX = 1024;

let fontFamily: string | null = null;

function displayFont(weight: number, px: number): string {
  // The site's display face. A canvas cannot resolve a CSS variable itself,
  // so the family name next/font generated is read off the document once.
  if (fontFamily === null) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
    fontFamily = v ? `${v}, ui-rounded, system-ui, sans-serif` : 'ui-rounded, system-ui, sans-serif';
  }
  return `${weight} ${px}px ${fontFamily}`;
}

/** Letters along a circle. `top` runs left-to-right over the top; otherwise under the bottom. */
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  top: boolean,
) {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const totalAngle = total / radius;
  // Centre the run on the vertical axis.
  let angle = top ? -Math.PI / 2 - totalAngle / 2 : Math.PI / 2 + totalAngle / 2;
  for (let i = 0; i < chars.length; i += 1) {
    const half = widths[i] / 2 / radius;
    angle += top ? half : -half;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle + (top ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += top ? half : -half;
  }
}

/** Shrinks a font size until the text fits the width. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number): number {
  let px = max;
  ctx.font = displayFont(weight, px);
  while (px > 40 && ctx.measureText(text).width > width) {
    px -= 8;
    ctx.font = displayFont(weight, px);
  }
  return px;
}

type FaceArt = { map: THREE.CanvasTexture; bump: THREE.CanvasTexture };

/**
 * Draws one face twice: in colour for the map, and in greyscale for the bump
 * map. Both use identical geometry so the relief lines up with the lettering.
 */
function drawFace(
  tier: MedalTier,
  draw: (ctx: CanvasRenderingContext2D, ink: string, mode: 'color' | 'bump') => void,
): FaceArt {
  const metal = METALS[tier];
  const make = (mode: 'color' | 'bump') => {
    const canvas = document.createElement('canvas');
    canvas.width = TEX;
    canvas.height = TEX;
    const ctx = canvas.getContext('2d')!;
    if (mode === 'color') {
      // Almost flat: the highlights must come from the lights and move with
      // the coin, not be painted on. A faint warm centre only.
      const g = ctx.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX * 0.5);
      g.addColorStop(0, metal.light);
      g.addColorStop(0.08, metal.color);
      g.addColorStop(1, metal.color);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#808080';
    }
    ctx.fillRect(0, 0, TEX, TEX);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    draw(ctx, mode === 'color' ? metal.dark : '#ffffff', mode);
    const tex = new THREE.CanvasTexture(canvas);
    if (mode === 'color') tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  return { map: make('color'), bump: make('bump') };
}

function frontArt(tier: MedalTier, rank: number, metric: string, when: string): FaceArt {
  return drawFace(tier, (ctx, ink) => {
    const c = TEX / 2;
    ctx.fillStyle = ink;
    // A thin ring inside the rim frames the lettering.
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(c, c, TEX * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = displayFont(700, 300);
    ctx.fillText(ORDINAL[rank] ?? String(rank), c, c + 10);

    ctx.font = displayFont(700, 78);
    arcText(ctx, metric.toUpperCase(), c, c, TEX * 0.355, true);
    ctx.font = displayFont(600, 62);
    arcText(ctx, when.toUpperCase(), c, c, TEX * 0.355, false);
  });
}

function backArt(tier: MedalTier, owner: string, name: string): FaceArt {
  return drawFace(tier, (ctx, ink, mode) => {
    const c = TEX / 2;
    ctx.fillStyle = ink;
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(c, c, TEX * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = displayFont(600, 60);
    arcText(ctx, 'HELD BY', c, c, TEX * 0.355, true);
    ctx.font = displayFont(600, 52);
    arcText(ctx, name.toUpperCase(), c, c, TEX * 0.355, false);

    // The name: as large as fits, wrapped onto a second line if it must.
    const words = owner.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    ctx.font = displayFont(800, 160);
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > TEX * 0.52 && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 2);
    const max = shown.length === 1 ? 190 : 140;
    const px = Math.min(...shown.map((l) => fitFont(ctx, l, 800, max, TEX * 0.56)));
    ctx.font = displayFont(800, px);
    // In colour the recess reads darker, with a light lip below each letter,
    // so the lettering looks cut in even where the bump map is subtle.
    if (mode === 'color') {
      ctx.shadowColor = 'rgba(255,255,255,.45)';
      ctx.shadowOffsetY = 4;
    }
    const gap = px * 1.05;
    shown.forEach((l, i) => {
      ctx.fillText(l.toUpperCase(), c, c + (i - (shown.length - 1) / 2) * gap);
    });
  });
}

/** The coin body: a bevelled disc plus a raised rim on each face. */
function useCoinGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, RADIUS, 0, Math.PI * 2, false);
    const body = new THREE.ExtrudeGeometry(shape, {
      depth: THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 6,
      curveSegments: 128,
    });
    body.center();
    const rim = new THREE.TorusGeometry(RIM_RADIUS, RIM_TUBE, 24, 128);
    const face = new THREE.CircleGeometry(FACE_RADIUS, 128);
    return { body, rim, face };
  }, []);
}

function Coin({ tier, front, back }: { tier: MedalTier; front: FaceArt; back: FaceArt }) {
  const metal = METALS[tier];
  const { body, rim, face } = useCoinGeometry();
  const half = THICKNESS / 2 + 0.03; // body plus bevel

  return (
    <group>
      <mesh geometry={body}>
        <meshPhysicalMaterial
          color={metal.color}
          metalness={1}
          roughness={metal.roughness}
          clearcoat={0.25}
          clearcoatRoughness={0.3}
        />
      </mesh>
      {[half, -half].map((z) => (
        <mesh key={z} geometry={rim} position={[0, 0, z]}>
          <meshPhysicalMaterial
            color={metal.color}
            metalness={1}
            roughness={metal.roughness * 0.8}
            clearcoat={0.4}
            clearcoatRoughness={0.25}
          />
        </mesh>
      ))}
      {/* Front face: the lettering is the bright part of the bump map, and a
          positive scale makes bright mean high, so it stands proud. */}
      <mesh geometry={face} position={[0, 0, half + 0.002]}>
        <meshPhysicalMaterial
          map={front.map}
          bumpMap={front.bump}
          bumpScale={0.025}
          metalness={1}
          roughness={metal.roughness + 0.08}
          clearcoat={0.15}
        />
      </mesh>
      {/* Back face: same drawing, negative scale, so the name is cut in. */}
      <mesh geometry={face} position={[0, 0, -(half + 0.002)]} rotation={[0, Math.PI, 0]}>
        <meshPhysicalMaterial
          map={back.map}
          bumpMap={back.bump}
          bumpScale={-0.05}
          metalness={1}
          roughness={metal.roughness + 0.12}
          clearcoat={0.15}
        />
      </mesh>
    </group>
  );
}

/**
 * Soft panels around the coin, rendered once into the environment map. Metal
 * with nothing to reflect is black; these are the "studio" it reflects.
 */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, -6]} scale={[12, 3, 1]} />
      <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-6, 1, 0]} scale={[8, 2, 1]} />
      <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[6, 1, 0]} scale={[8, 2, 1]} />
      <Lightformer intensity={1.2} position={[0, 0, 6]} scale={[6, 6, 1]} form="ring" />
      <Lightformer intensity={0.6} rotation-x={-Math.PI / 2} position={[0, -5, 0]} scale={[12, 12, 1]} color="#cbbfff" />
    </Environment>
  );
}

export type Medal3DProps = {
  tier: MedalTier;
  rank: number;
  /** The board, e.g. "Daily NOTES spent". */
  metric: string;
  /** The month, e.g. "September 2026", or "This month". */
  when: string;
  /** Whose name goes on the back. */
  owner: string;
  /** The badge's full name, written small on the back. */
  name: string;
  size?: number;
};

export default function Medal3D({ tier, rank, metric, when, owner, name, size = 320 }: Medal3DProps) {
  const [spinning, setSpinning] = useState(true);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);

  const front = useMemo(() => frontArt(tier, rank, metric, when), [tier, rank, metric, when]);
  const back = useMemo(() => backArt(tier, owner, name), [tier, owner, name]);
  useEffect(
    () => () => {
      front.map.dispose();
      front.bump.dispose();
      back.map.dispose();
      back.bump.dispose();
    },
    [front, back],
  );
  useEffect(() => () => { if (resume.current) clearTimeout(resume.current); }, []);

  return (
    <div style={{ width: size, height: size, maxWidth: '100%' }} className="mx-auto touch-none">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0.5, 3.4], fov: 38 }}
        aria-label={`${METALS[tier].name} medal: ${name}, held by ${owner}`}
        role="img"
      >
        <Studio />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <directionalLight position={[-4, -1, 3]} intensity={0.7} />
        <pointLight position={[0, 2, -4]} intensity={1.2} />
        <Coin tier={tier} front={front} back={back} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={spinning}
          autoRotateSpeed={2.2}
          rotateSpeed={0.9}
          onStart={() => {
            if (resume.current) clearTimeout(resume.current);
            setSpinning(false);
          }}
          onEnd={() => {
            resume.current = setTimeout(() => setSpinning(true), 2500);
          }}
        />
      </Canvas>
    </div>
  );
}
