#!/usr/bin/env node
// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver) which live pages are new or changed.
//
//   node scripts/indexnow.mjs [state.json]
//
// Reads the live sitemap, hashes each page's <main>, and submits only the URLs whose hash
// differs from the state file (all of them on the first run), then writes the new state.
// Google does not use IndexNow; it reads the sitemap through Search Console.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://malonzol.com';
export const KEY = '30ca49c32bfcff36c562fcef01122cc7';

export const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/** Hash of the page's main content, so a change to shared chrome alone does not resubmit every page. */
export const contentHash = (html) => {
  const main = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? html;
  return createHash('sha256').update(main).digest('hex').slice(0, 16);
};

/** URLs that are new or whose hash changed since the last run. */
export const changed = (prev, next) => Object.keys(next).filter((u) => prev[u] !== next[u]);

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'malonzol-indexnow' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

async function main() {
  const stateFile = process.argv[2] ?? '.indexnow-state.json';
  const prev = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};

  // The key file must be live before engines will accept a submission.
  if ((await get(`${SITE}/${KEY}.txt`)).trim() !== KEY) throw new Error('IndexNow key file does not match');

  const index = await get(`${SITE}/sitemap-index.xml`);
  const urls = (await Promise.all(locs(index).map(get))).flatMap(locs);
  const next = {};
  for (const u of urls) next[u] = contentHash(await get(u));

  const list = changed(prev, next);
  console.log(`${urls.length} pages in sitemap, ${list.length} new or changed`);
  if (list.length) {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: list }),
    });
    // 200 and 202 both mean accepted; anything else leaves the state unchanged so the next run retries.
    if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
    list.forEach((u) => console.log(`  ${u}`));
  }
  writeFileSync(stateFile, JSON.stringify(next, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
