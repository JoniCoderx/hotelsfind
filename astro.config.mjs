import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { readdirSync, readFileSync } from 'node:fs';
import { copiesIn } from './src/lib/samehotel.mjs';

// The canonical domain. Override with SITE_URL for preview deployments.
const site = process.env.SITE_URL || 'https://malonzol.com';
// Per-hotel pages show only facts (name, address, stars, location) and our own text, no Agoda photos, texts or scores,
// so they are in search and in the sitemap. INDEX_HOTEL_PAGES=0 takes them out again.
const indexHotels = process.env.INDEX_HOTEL_PAGES !== '0';
// A place listed twice has one page in the sitemap; the copy's canonical points to it (see src/lib/samehotel.mjs).
const catalogDir = new URL('./src/data/catalog/', import.meta.url);
const copyPages = new Set(
  readdirSync(catalogDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => [...copiesIn(JSON.parse(readFileSync(new URL(f, catalogDir), 'utf8'))).keys()].map((id) => `/hotel/${f.slice(0, -5)}/${id}/`)),
);

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  // Pages are pre-rendered; only /api/* runs on the server (it holds the Agoda key).
  output: 'static',
  // Photos from Unsplash and Pexels are served through Vercel Image Optimization (see src/lib/photo.ts).
  adapter: vercel({
    imagesConfig: {
      sizes: [240, 320, 480, 640, 800, 1200, 1440, 1800, 2400],
      domains: ['images.pexels.com', 'images.unsplash.com'],
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60 * 60 * 24 * 30,
    },
  }),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search') && !page.includes('/go/') && !page.includes('/compare') && (indexHotels || !page.includes('/hotel/')) &&
        ![...copyPages].some((p) => page.endsWith(p)),
      i18n: { defaultLocale: 'he', locales: { he: 'he-IL' } },
    }),
  ],
  // CSS is small (about 7 KB gzipped per page), so it ships inside the HTML instead of blocking the first paint.
  build: { inlineStylesheets: 'always' },
});
