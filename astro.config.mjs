import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// The canonical domain. Override with SITE_URL for preview deployments.
const site = process.env.SITE_URL || 'https://hotelfindz.com';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  // Pages are pre-rendered; only /api/* runs on the server (it holds the Agoda key).
  output: 'static',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/search'),
      i18n: { defaultLocale: 'he', locales: { he: 'he-IL' } },
    }),
  ],
  build: { inlineStylesheets: 'auto' },
});
