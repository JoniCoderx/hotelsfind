import type { APIRoute } from 'astro';
import { subscribe, validEmail } from '../../lib/subscribe';

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// A few sign-ups per address a minute is plenty; this only slows down a script hammering one instance.
const recent = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 5;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  // Bots fill every field; people never see this one.
  if (body.website) return json({ ok: true });
  const email = validEmail(body.email);
  if (!email) return json({ error: 'bad_email' }, 400);
  if (limited(clientAddress ?? 'unknown')) return json({ error: 'too_many' }, 429);
  const result = await subscribe(email, { key: process.env.RESEND_API_KEY, segment: process.env.RESEND_SEGMENT_ID });
  if (result === 'not_configured') return json({ error: 'not_configured' }, 503);
  if (result === 'failed') return json({ error: 'failed' }, 502);
  return json({ ok: true, already: result === 'already' });
};
