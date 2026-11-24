export type ArtworkKind = 'vehicles' | 'instructors';

/*
 * Artwork is found by slug: `assets/artwork/<kind>/<slug>.<svg|webp|png>`, 2:1 for vehicles and 6:7 for
 * instructors. To change a picture, replace its file (remove the old one if the extension differs).
 */
const FILES = import.meta.glob<string>('../assets/artwork/*/*.{svg,webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const URLS = new Map(
  Object.entries(FILES).map(([path, url]) => [path.replace('../assets/artwork/', '').replace(/\.\w+$/, ''), url]),
);

export function artworkUrl(kind: ArtworkKind, slug: string): string | null {
  return URLS.get(`${kind}/${slug}`) ?? null;
}
