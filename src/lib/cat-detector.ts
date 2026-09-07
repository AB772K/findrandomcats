import 'server-only';

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import sharp from 'sharp';

/**
 * Server-side "is there actually a cat in this?" check, run before an upload is
 * published. MobileNet classifies against ImageNet locally -- no API key, and
 * the image never leaves the server.
 *
 * BACKEND: this runs on the pure-JavaScript tfjs CPU backend, not
 * @tensorflow/tfjs-node. tfjs-node needs a native addon and Google publishes no
 * prebuilt Windows binary for 4.22.0 (every napi-vN URL 404s), so it cannot be
 * installed here. The tradeoff is speed: one classification is ~2.3s on the JS
 * backend versus roughly a tenth of that natively, which is why the scan below
 * short-circuits rather than always checking every crop. On a Linux deployment,
 * `npm i @tensorflow/tfjs-node` and pointing the tf import on the next line at
 * it is the only edit needed -- everything else here is unchanged.
 */

/**
 * ImageNet has no single "cat" class; it has a dozen breeds and wild cousins.
 * Matched as substrings, which is why these are specific phrases and not the
 * bare word "cat" -- ImageNet also contains "Madagascar cat" (a lemur) and
 * "cat bear" (a red panda), neither of which is a cat.
 */
const CAT_LABELS = [
  'tabby',
  'tiger cat',
  'persian cat',
  'siamese cat',
  'egyptian cat',
  'cougar',
  'puma',
  'mountain lion',
  'lynx',
  'catamount',
];

/**
 * MobileNet splits cats across many breed classes, so an obvious cat often
 * scores 0.09 tabby + 0.07 tiger cat rather than 0.40 of any one label. Every
 * cat class is therefore summed before comparing, and the bar is deliberately
 * low. Measured on real photos: clear cats land at 25-87%, a kitten half hidden
 * behind a rabbit at 36%, and non-cats at 0%.
 */
const CONFIDENCE_THRESHOLD = 0.15;

/** How many predictions to consider per view. MobileNet's tail is noise. */
const TOP_K = 10;

const INPUT_SIZE = 224;

/**
 * Weights are fetched over the network the first time a server process needs
 * them. Without a ceiling a slow CDN would hang the upload forever; with one it
 * fails fast and says so. The scan budget is generous because a full seven-view
 * scan on the JS backend takes ~16s.
 */
const MODEL_LOAD_TIMEOUT_MS = 30_000;
const SCAN_TIMEOUT_MS = 45_000;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

export type CatCheck =
  | { ok: true; confidence: number }
  | { ok: false; reason: 'no-cat'; confidence: number }
  | { ok: false; reason: 'unavailable' };

let modelPromise: Promise<mobilenet.MobileNet> | null = null;

/**
 * Loads MobileNet once per server process. v1 rather than v2: the v2 weights
 * come from TFHub, which now 404s, while v1 still resolves from
 * storage.googleapis.com/tfjs-models. On failure the cached promise is cleared
 * so a later upload retries instead of being stuck with a rejected promise.
 */
function loadModel(): Promise<mobilenet.MobileNet> {
  if (!modelPromise) {
    modelPromise = mobilenet.load({ version: 1, alpha: 1.0 }).catch((cause) => {
      modelPromise = null;
      throw cause;
    });
  }
  return modelPromise;
}

function catConfidence(predictions: { className: string; probability: number }[]): number {
  return predictions
    .filter((p) => CAT_LABELS.some((needle) => p.className.toLowerCase().includes(needle)))
    .reduce((sum, p) => sum + p.probability, 0);
}

async function classify(model: mobilenet.MobileNet, rgb: Buffer): Promise<number> {
  const tensor = tf.tensor3d(new Uint8Array(rgb), [INPUT_SIZE, INPUT_SIZE, 3], 'int32');
  try {
    return catConfidence(await model.classify(tensor, TOP_K));
  } finally {
    tensor.dispose();
  }
}

const toRgb = (pipeline: sharp.Sharp) => pipeline.removeAlpha().raw().toBuffer();

/**
 * Returns whether the image contains a cat.
 *
 * Any failure to decide -- model unavailable, unreadable image, timeout --
 * comes back as 'unavailable' so the caller can reject the upload. This never
 * returns ok on an error path.
 */
export async function detectCat(bytes: ArrayBuffer): Promise<CatCheck> {
  try {
    const model = await withTimeout(loadModel(), MODEL_LOAD_TIMEOUT_MS, 'model load');
    return await withTimeout(scan(model, Buffer.from(bytes)), SCAN_TIMEOUT_MS, 'cat scan');
  } catch (cause) {
    console.error('[cat-detector] could not classify upload:', cause);
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * A single 224x224 look at the whole frame misses cats that are small or off
 * centre -- a cat sitting on a wall across a garden classifies as "pedestal".
 * So the image is scanned as several views and the best score wins. Views are
 * ordered by payoff and the scan stops the moment one clears the threshold, so
 * an ordinary cat portrait costs one pass and only ambiguous images pay for the
 * full set.
 */
async function scan(model: mobilenet.MobileNet, input: Buffer): Promise<CatCheck> {
  // rotate() applies EXIF orientation; without it a phone photo arrives sideways.
  const upright = await sharp(input).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(upright).metadata();
  if (!width || !height) return { ok: false, reason: 'unavailable' };

  let best = 0;
  const consider = async (rgb: Buffer) => {
    best = Math.max(best, await classify(model, rgb));
    return best >= CONFIDENCE_THRESHOLD;
  };

  // 1. Centre crop -- what MobileNet was trained on, and how most cat photos
  //    are framed.
  const centre = await toRgb(sharp(upright).resize(INPUT_SIZE, INPUT_SIZE, { fit: 'cover' }));
  if (await consider(centre)) return { ok: true, confidence: best };

  // 2. Whole frame letterboxed, so a cat at the edge is not cropped away.
  const whole = await toRgb(
    sharp(upright).resize(INPUT_SIZE, INPUT_SIZE, {
      fit: 'contain',
      background: { r: 124, g: 116, b: 104 },
    }),
  );
  if (await consider(whole)) return { ok: true, confidence: best };

  // 3. Overlapping 60% tiles. This is what rescues a small or partly hidden
  //    cat: it fills enough of a tile to register.
  const tileW = Math.max(1, Math.floor(width * 0.6));
  const tileH = Math.max(1, Math.floor(height * 0.6));
  const offsets: [number, number][] = [
    [Math.floor((width - tileW) / 2), Math.floor((height - tileH) / 2)],
    [0, 0],
    [width - tileW, 0],
    [0, height - tileH],
    [width - tileW, height - tileH],
  ];

  for (const [left, top] of offsets) {
    const tile = await toRgb(
      sharp(upright)
        .extract({ left, top, width: tileW, height: tileH })
        .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' }),
    );
    if (await consider(tile)) return { ok: true, confidence: best };
  }

  return { ok: false, reason: 'no-cat', confidence: best };
}

export const NO_CAT_MESSAGE =
  'We could not find a cat in that photo. FindRandomCats is cats only — try another one, ' +
  'ideally with the cat filling more of the frame.';

export const UNAVAILABLE_MESSAGE =
  'We could not check that photo for cats just now. Please try uploading it again in a moment.';
