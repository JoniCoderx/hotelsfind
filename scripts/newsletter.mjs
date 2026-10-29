#!/usr/bin/env node
// Builds a newsletter issue from a JSON file and saves it in Resend as a DRAFT broadcast to the subscribers'
// segment. Nothing is sent: open the draft in Resend, check it, and press Send there.
//
//   node scripts/newsletter.mjs emails/2026-11-01.json --preview issue.html   # just write the HTML
//   RESEND_API_KEY=... RESEND_SEGMENT_ID=... node scripts/newsletter.mjs emails/2026-11-01.json
//
// The issue format is documented on newsletterEmail() in src/lib/email/templates.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { FROM, REPLY_TO, newsletterEmail } from '../src/lib/email/templates.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/newsletter.mjs <issue.json> [--preview out.html]');
  process.exit(1);
}
const issue = JSON.parse(readFileSync(file, 'utf8'));
const campaign = basename(file, '.json');
const { subject, html } = newsletterEmail(issue, { campaign });

const preview = rest.indexOf('--preview');
if (preview !== -1) {
  writeFileSync(rest[preview + 1] ?? `${campaign}.html`, html);
  console.log(`preview written. subject: ${subject}`);
  process.exit(0);
}

const key = process.env.RESEND_API_KEY;
const segment = process.env.RESEND_SEGMENT_ID;
if (!key || !segment) {
  console.error('RESEND_API_KEY and RESEND_SEGMENT_ID must be set');
  process.exit(1);
}
const res = await fetch('https://api.resend.com/broadcasts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ segment_id: segment, from: FROM, reply_to: REPLY_TO, subject, html, name: campaign, send: false }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('resend', res.status, JSON.stringify(data));
  process.exit(1);
}
console.log(`draft saved: "${subject}" (${data.id}). Review and send it at https://resend.com/broadcasts`);
