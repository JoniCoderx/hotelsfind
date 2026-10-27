// Photos are hotlinked from the Unsplash and Pexels CDNs. Both licenses allow
// free commercial use without attribution; we still credit sources on /credits.

export type Photo = ({ unsplash: string } | { pexels: number }) & { alt: string };

const WIDTHS = [480, 800, 1200, 1800, 2400];

export function photoSrc(p: Photo, w = 1200): string {
  if ('unsplash' in p) {
    return `https://images.unsplash.com/photo-${p.unsplash}?auto=format&q=72&w=${w}`;
  }
  return `https://images.pexels.com/photos/${p.pexels}/pexels-photo-${p.pexels}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

export function photoSrcset(p: Photo, max = 2400): string {
  return WIDTHS.filter((w) => w <= max)
    .map((w) => `${photoSrc(p, w)} ${w}w`)
    .join(', ');
}

export function photoPage(p: Photo): string {
  return 'unsplash' in p ? `https://images.unsplash.com/photo-${p.unsplash}` : `https://www.pexels.com/photo/${p.pexels}/`;
}
