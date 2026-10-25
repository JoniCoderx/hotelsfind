import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The canonical domain. Override with SITE_URL when deploying elsewhere
// (e.g. a GitHub Pages preview).
const site = process.env.SITE_URL || 'https://hotelsfind.co.il';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search'),
      i18n: { defaultLocale: 'he', locales: { he: 'he-IL' } },
    }),
  ],
  build: { inlineStylesheets: 'auto' },
});
