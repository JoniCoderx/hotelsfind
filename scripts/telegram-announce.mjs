#!/usr/bin/env node
// Post a one-off announcement to the Telegram channel, by hand (the Telegram announce workflow).
//
//   TELEGRAM_BOT_TOKEN=... node scripts/telegram-announce.mjs join-tiktok [--dry-run]
//
// Each announcement is a folder in announcements/: image.jpg, caption.html (Telegram HTML) and, optionally,
// button.json ({ text, url }) for a button under the post.
import { existsSync, readFileSync } from 'node:fs';
import { CHANNEL } from './telegram.mjs';

const name = process.argv[2] ?? '';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('usage: telegram-announce.mjs <announcement folder>');
const dir = new URL(`../announcements/${name}/`, import.meta.url);
const caption = readFileSync(new URL('caption.html', dir), 'utf8').trim();
const image = readFileSync(new URL('image.jpg', dir));
const button = existsSync(new URL('button.json', dir)) ? JSON.parse(readFileSync(new URL('button.json', dir), 'utf8')) : null;
if (caption.length > 1024) throw new Error(`caption is ${caption.length} characters; Telegram allows 1024`);

if (process.argv.includes('--dry-run')) {
  console.log({ chat: CHANNEL, caption, button, image: `${image.length} bytes` });
} else {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const form = new FormData();
  form.append('chat_id', CHANNEL);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (button) form.append('reply_markup', JSON.stringify({ inline_keyboard: [[button]] }));
  form.append('photo', new Blob([image], { type: 'image/jpeg' }), `${name}.jpg`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) throw new Error(`sendPhoto: ${data.description}`);
  console.log(`posted ${name}: message ${data.result.message_id}`);
}
