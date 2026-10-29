import type { APIRoute } from 'astro';
import { HOTEL_KEY, hotelOffers, usdToIls } from '../../lib/xotelo';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });

/** Nightly rate per booking site for one hotel: /api/offers?key=g293980-d308523&in=2026-12-03&out=2026-12-06&a=2&r=1 */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const key = p.get('key') || '';
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  if (!HOTEL_KEY.test(key)) return json({ error: 'bad_key' }, 400);
  if (!DATE.test(checkin) || !DATE.test(checkout)) return json({ error: 'bad_dates' }, 400);
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30 || Date.parse(checkin) < Date.now() - 2 * DAY) return json({ error: 'bad_dates' }, 400);
  const adults = Number(p.get('a') || 2);
  const rooms = Number(p.get('r') || 1);
  if (!Number.isInteger(adults) || adults < 1 || adults > 16 || !Number.isInteger(rooms) || rooms < 1 || rooms > 8) {
    return json({ error: 'bad_guests' }, 400);
  }
  try {
    const offers = await hotelOffers(key, { checkin, checkout, adults, rooms }, await usdToIls());
    // Prices move during the day; half an hour keeps repeat searches fast without going stale.
    return json({ offers, checkedAt: new Date().toISOString() }, 200, 'public, s-maxage=1800, stale-while-revalidate=600');
  } catch (e) {
    console.error('offers', (e as Error).message);
    return json({ error: 'unavailable', offers: [] }, 502);
  }
};
