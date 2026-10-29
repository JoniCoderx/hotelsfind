// Newsletter sign-up: saves the address as a Resend contact and, for a new contact, sends the welcome email.
// Needs RESEND_API_KEY (and RESEND_SEGMENT_ID to put sign-ups in a segment for broadcasts).

import { FROM, REPLY_TO, welcomeEmail } from './email/templates.mjs';

const API = 'https://api.resend.com';

/** A sane, deliverable-looking address: one @, a dotted domain, no spaces, at most 254 characters. */
export function validEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export type SubscribeResult = 'subscribed' | 'already' | 'not_configured' | 'failed';

type Fetch = typeof fetch;

export async function subscribe(email: string, env: { key?: string; segment?: string }, f: Fetch = fetch): Promise<SubscribeResult> {
  if (!env.key) return 'not_configured';
  const headers = { Authorization: `Bearer ${env.key}`, 'Content-Type': 'application/json' };
  const contact = await f(`${API}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, unsubscribed: false, ...(env.segment ? { segments: [{ id: env.segment }] } : {}) }),
  });
  if (!contact.ok) {
    const text = await contact.text();
    // An address that is already on the list gets no second welcome email.
    if (contact.status === 409 || /already exists/i.test(text)) return 'already';
    console.error('resend contact', contact.status, text.slice(0, 300));
    return 'failed';
  }
  const { subject, html } = welcomeEmail();
  const sent = await f(`${API}/emails`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ from: FROM, to: [email], reply_to: REPLY_TO, subject, html }),
  });
  // The address is on the list either way; a missed welcome email shouldn't fail the sign-up.
  if (!sent.ok) console.error('resend welcome', sent.status, (await sent.text()).slice(0, 300));
  return 'subscribed';
}
