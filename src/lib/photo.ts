// Photos are hotlinked from the Unsplash and Pexels CDNs. Both licenses allow
// free commercial use without attribution; we still credit sources on /credits.

export type Photo = ({ unsplash: string } | { pexels: number }) & { alt: string };

// Widths we serve. They must match `imagesConfig.sizes` in astro.config.mjs.
export const WIDTHS = [240, 320, 480, 640, 800, 1200, 1800, 2400];

/** The photo straight from its CDN. */
export function photoOrigin(p: Photo, w = 1200): string {
  if ('unsplash' in p) {
    return `https://images.unsplash.com/photo-${p.unsplash}?auto=format&q=55&w=${w}`;
  }
  return `https://images.pexels.com/photos/${p.pexels}/pexels-photo-${p.pexels}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

// On Vercel, photos are served from our own domain through Vercel Image Optimization: some browsers and
// networks get blocked by the Pexels CDN, and its Cloudflare cookies cost us in Lighthouse. Elsewhere
// (local builds, tests) the CDN URL is used as is.
const onVercel = typeof process !== 'undefined' && process.env.VERCEL === '1';

export function photoSrc(p: Photo, w = 1200): string {
  const width = WIDTHS.find((x) => x >= w) ?? WIDTHS[WIDTHS.length - 1];
  if (!onVercel) return photoOrigin(p, width);
  // Fetch the source once at 2400px; Vercel resizes and converts it (AVIF/WebP) per width.
  return `/_vercel/image?url=${encodeURIComponent(photoOrigin(p, 2400))}&w=${width}&q=60`;
}

export function photoSrcset(p: Photo, max = 2400): string {
  return WIDTHS.filter((w) => w >= 320 && w <= max)
    .map((w) => `${photoSrc(p, w)} ${w}w`)
    .join(', ');
}

export function photoPage(p: Photo): string {
  return 'unsplash' in p ? `https://images.unsplash.com/photo-${p.unsplash}` : `https://www.pexels.com/photo/${p.pexels}/`;
}
