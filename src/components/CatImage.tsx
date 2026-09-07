import Image from 'next/image';
import type { Cat, CatSourceType } from '@/lib/types';

const SOURCE_LABELS: Record<Exclude<CatSourceType, 'user_upload'>, string> = {
  cat_api: 'The Cat API',
  wikimedia: 'Wikimedia Commons',
  unsplash: 'Unsplash',
};

function Credit({ cat }: { cat: Cat }) {
  // Uploads by our own users need no attribution line.
  if (cat.source_type === 'user_upload') return null;

  const source = SOURCE_LABELS[cat.source_type];
  const author = cat.author_name?.trim();

  return (
    <p className="mt-2 text-xs text-ink/45">
      {author ? `${author} via ` : 'via '}
      {cat.source_url ? (
        <a
          href={cat.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline decoration-dotted hover:text-ink"
        >
          {source}
        </a>
      ) : (
        source
      )}
      {cat.license ? ` · ${cat.license}` : null}
    </p>
  );
}

export default function CatImage({ cat, priority = false }: { cat: Cat; priority?: boolean }) {
  return (
    <figure>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-lilac-50 shadow-soft">
        <Image
          src={cat.image_url}
          alt={cat.caption ?? 'A random cat'}
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          priority={priority}
          className="object-cover"
          unoptimized
        />
      </div>
      <figcaption>
        {cat.caption ? <p className="mt-3 text-sm text-ink/75">{cat.caption}</p> : null}
        <Credit cat={cat} />
      </figcaption>
    </figure>
  );
}
