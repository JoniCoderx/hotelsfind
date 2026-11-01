import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// The canonical domain. Override with SITE_URL for preview deployments.
const site = process.env.SITE_URL || 'https://malonzol.com';
// Per-hotel pages reuse Agoda content; keep them out of search until Agoda approves that use in writing.
const indexHotels = process.env.INDEX_HOTEL_PAGES === '1';

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
      filter: (page) => !page.includes('/search') && !page.includes('/go/') && !page.includes('/compare') && (indexHotels || !page.includes('/hotel/')),
      i18n: { defaultLocale: 'he', locales: { he: 'he-IL' } },
    }),
  ],
  // CSS is small (about 7 KB gzipped per page), so it ships inside the HTML instead of blocking the first paint.
  build: { inlineStylesheets: 'always' },
});
