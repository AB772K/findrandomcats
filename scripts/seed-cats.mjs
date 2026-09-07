/**
 * Seeds the `cats` table with ~20 photos from The Cat API (no key required for
 * the basic search endpoint).
 *
 *   npm run seed
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (the anon key cannot insert cats that belong to no profile).
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET = 20;

if (!url || !serviceKey) {
  console.error(
    'Missing credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const response = await fetch(
  `https://api.thecatapi.com/v1/images/search?limit=${TARGET}&size=small&mime_types=jpg,png`,
);

if (!response.ok) {
  console.error(`The Cat API returned ${response.status} ${response.statusText}`);
  process.exit(1);
}

const images = await response.json();

// The API caps anonymous requests at 10 per call, so top up until we hit TARGET.
const collected = new Map(images.map((image) => [image.id, image]));
while (collected.size < TARGET) {
  const extra = await fetch(
    'https://api.thecatapi.com/v1/images/search?limit=10&size=small&mime_types=jpg,png',
  ).then((res) => res.json());

  const before = collected.size;
  for (const image of extra) collected.set(image.id, image);
  if (collected.size === before) break; // API stopped giving us anything new.
}

const rows = [...collected.values()].slice(0, TARGET).map((image) => ({
  image_url: image.url,
  source_type: 'cat_api',
  source_url: `https://thecatapi.com/`,
  author_name: image.breeds?.[0]?.name ? `${image.breeds[0].name} (The Cat API)` : 'The Cat API',
  license: 'The Cat API terms of use',
}));

const existing = await supabase.from('cats').select('image_url').eq('source_type', 'cat_api');
if (existing.error) {
  console.error(`Could not read existing cats: ${existing.error.message}`);
  process.exit(1);
}

const known = new Set((existing.data ?? []).map((row) => row.image_url));
const fresh = rows.filter((row) => !known.has(row.image_url));

if (fresh.length === 0) {
  console.log(`Nothing new to add — ${known.size} Cat API cats already seeded.`);
  process.exit(0);
}

const { error } = await supabase.from('cats').insert(fresh);
if (error) {
  console.error(`Insert failed: ${error.message}`);
  process.exit(1);
}

console.log(`Seeded ${fresh.length} cats (${known.size + fresh.length} total from The Cat API).`);
