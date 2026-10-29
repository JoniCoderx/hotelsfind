import type { APIRoute } from 'astro';
import { hotelLinks } from '../../lib/hotellinks';
import { parseGuests, type Guests } from '../../lib/guests';
import { findDestination } from '../../lib/resolve';
import { HOTEL_KEY, hotelOffers, usdToIls } from '../../lib/xotelo';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

/**
 * Nightly rate per booking site for one hotel, each with a link that opens that hotel on the site:
 * /api/offers?key=g293980-d308523&slug=eilat&name=…&lat=…&lng=…&in=2026-12-03&out=2026-12-06&a=2&c=1&ages=7&r=1
 */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const key = p.get('key') || '';
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  const name = (p.get('name') || '').slice(0, 120);
  const dest = findDestination({ slug: p.get('slug'), q: p.get('q'), d: p.get('d') });
  if (!HOTEL_KEY.test(key) || !name || !dest) return json({ error: 'bad_hotel' }, 400);
  if (!DATE.test(checkin) || !DATE.test(checkout)) return json({ error: 'bad_dates' }, 400);
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30 || Date.parse(checkin) < Date.now() - 2 * DAY) return json({ error: 'bad_dates' }, 400);
  // Children without ages still get prices (Xotelo prices the adults only) and links with the count.
  const parsed = parseGuests(p);
  const guests: Guests =
    'error' in parsed
      ? { ...(parseGuests(new URLSearchParams({ a: p.get('a') || '2', r: p.get('r') || '1' })) as Guests), children: Math.min(10, Math.max(0, Number(p.get('c')) || 0)), childAges: [] }
      : parsed;
  const coord = (k: string) => {
    const n = Number(p.get(k));
    return p.has(k) && Number.isFinite(n) ? n : undefined;
  };
  const ctx = {
    slug: dest.slug,
    key,
    name,
    lat: coord('lat'),
    lng: coord('lng'),
    city: dest.en,
    stay: { checkin, checkout, adults: guests.adults, children: guests.children, childAges: guests.childAges, rooms: guests.rooms },
  };
  try {
    const rates = await hotelOffers(key, { checkin, checkout, adults: guests.adults, rooms: guests.rooms }, await usdToIls());
    // Each link is followed with this exact stay, so "direct" means it opened the hotel's page just now.
    const links = await hotelLinks(ctx, rates.map((o) => o.site));
    const offers = rates.map((o) => ({ ...o, ...links[o.site] }));
    // Prices move during the day: half an hour keeps repeat searches fast; an empty answer is retried soon.
    const cache = offers.length ? 'public, s-maxage=1800, stale-while-revalidate=600' : 'public, s-maxage=120';
    return json({ offers, fallback: links.booking, checkedAt: new Date().toISOString() }, 200, cache);
  } catch (e) {
    console.error('offers', (e as Error).message);
    return json({ error: 'unavailable', offers: [] }, 502);
  }
};
