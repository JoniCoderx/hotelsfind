#!/usr/bin/env node
// Post MalonZol guides to the Telegram channel.
//
//   TELEGRAM_BOT_TOKEN=... node scripts/telegram.mjs state.json [--new-only] [--dry-run]
//
// Reads the live guides index (newest first) and the state file of what is already posted. Each run posts
// every guide that is new since the last run (at most MAX_NEW), or, when nothing is new, the next guide from
// the back catalogue, so the channel gets one post a day without a burst. Each post is a branded card
// (scripts/telegram-card.mjs, needs Playwright's Chromium), the description and links. --dry-run saves the
// cards to the current directory instead of posting. The bot must be an admin of the channel with
// permission to post.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderCard } from './telegram-card.mjs';

export const SITE = 'https://malonzol.com';
export const CHANNEL = '@malonzol';
export const INSTAGRAM = 'https://www.instagram.com/malonzoll/';
const MAX_NEW = 2;

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Guide URLs in the order the guides index lists them (newest first), without duplicates. */
export function guideLinks(html) {
  const seen = new Set();
  for (const m of html.matchAll(/href="(\/guides\/[a-z0-9-]+\/)"/g)) seen.add(new URL(m[1], SITE).toString());
  return [...seen];
}

/** Title (the page's H1), description and share image of a guide page. */
export function pageInfo(html) {
  const meta = (p) => decode(html.match(new RegExp(`<meta (?:property|name)="${p}" content="([^"]*)"`))?.[1] ?? '');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
  const title = decode(h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || meta('og:title').replace(/\s*\|.*$/, '');
  return { title, description: meta('og:description') || meta('description'), image: meta('og:image') };
}

/** What to post this run: new guides first; otherwise one from the back catalogue. */
export function pick(links, state, newOnly = false) {
  const posted = new Set(state.posted ?? []);
  const known = new Set(state.known ?? []);
  const fresh = links.filter((u) => !known.has(u) && !posted.has(u)).slice(0, MAX_NEW);
  if (fresh.length || newOnly) return fresh;
  const next = links.find((u) => !posted.has(u));
  return next ? [next] : [];
}

export function caption({ title, description }, url) {
  const link = `${url}?utm_source=telegram&utm_medium=channel`;
  const more = `👉 <a href="${link}">לקריאת המדריך המלא</a>`;
  const foot = `✈️ <a href="https://t.me/${CHANNEL.slice(1)}">${CHANNEL}</a>  ·  📸 <a href="${INSTAGRAM}">אינסטגרם</a>`;
  const text = `<b>${esc(title)}</b>\n\n${esc(description)}\n\n${more}\n\n${foot}`;
  return { text: text.length > 1000 ? `<b>${esc(title)}</b>\n\n${more}\n\n${foot}` : text, link };
}

/** The buttons under a post: the guide, then Instagram and a share-to-a-friend link. */
export function buttons(title, link) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`;
  return {
    inline_keyboard: [
      [{ text: '📖 לקריאת המדריך', url: link }],
      [
        { text: '📸 אינסטגרם', url: INSTAGRAM },
        { text: '📤 שלחו לחבר', url: share },
      ],
    ],
  };
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'malonzol-telegram' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function send(token, method, body) {
  const form = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    ...(form ? {} : { headers: { 'content-type': 'application/json' } }),
    body: form ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
}

/** sendPhoto with the branded card uploaded as a file. */
function photoForm(card, fields) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  form.append('photo', new Blob([card], { type: 'image/jpeg' }), 'malonzol.jpg');
  return form;
}

async function main() {
  const stateFile = process.argv[2] ?? '.telegram-state.json';
  const dry = process.argv.includes('--dry-run');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token && !dry) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const newOnly = process.argv.includes('--new-only');
  const first = !existsSync(stateFile);
  const state = first ? { posted: [], known: [] } : JSON.parse(readFileSync(stateFile, 'utf8'));

  const links = guideLinks(await get(`${SITE}/guides/`));
  // On the very first run every existing guide is back catalogue, not news: start the daily drip, no burst.
  if (first) state.known = [...links];
  const todo = pick(links, state, newOnly);
  for (const url of todo) {
    const info = pageInfo(await get(url));
    const { text, link } = caption(info, url);
    const reply_markup = buttons(info.title, link);
    const fields = { chat_id: CHANNEL, caption: text, parse_mode: 'HTML', reply_markup };
    if (dry) {
      const card = await renderCard(info);
      writeFileSync(`${url.split('/').at(-2)}.jpg`, card);
      console.log(`--- would post ${url}\n${text}\n(card: ${url.split('/').at(-2)}.jpg)`);
    } else {
      try {
        await send(token, 'sendPhoto', photoForm(await renderCard(info), fields));
      } catch (e) {
        // Without the card, fall back to the plain share image, then to text, rather than skip the guide.
        console.warn(`card: ${e.message}`);
        try {
          await send(token, 'sendPhoto', { ...fields, photo: info.image });
        } catch {
          await send(token, 'sendMessage', { chat_id: CHANNEL, text, parse_mode: 'HTML', reply_markup });
        }
      }
      console.log(`posted ${url}`);
    }
    state.posted = [...new Set([...(state.posted ?? []), url])];
  }
  // Every guide that exists now counts as seen, so only later additions count as "new".
  state.known = [...new Set([...(state.known ?? []), ...links])];
  if (!dry) writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  if (!todo.length) console.log('nothing to post');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
