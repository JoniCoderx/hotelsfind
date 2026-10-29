import type { APIRoute } from 'astro';
import { parseGuests, type Guests } from '../../lib/guests';
import { HOTEL_KEY, hotelOffers, usdToIls } from '../../lib/xotelo';

export const prerender = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

/**
 * Nightly rates for a page of hotels in one request, streamed as each hotel's answer comes in:
 * /api/prices?keys=g1-d1,g1-d2,…&in=2026-12-03&out=2026-12-06&a=2&r=1
 * Each line is JSON: {"key":"g1-d1","offers":[{"site":"trip","price":879},…]}. One request instead of one per
 * hotel lets every hotel be asked at once (separate requests queued up at about one a second).
 */
export const GET: APIRoute = async ({ url }) => {
  const p = url.searchParams;
  const keys = [...new Set((p.get('keys') || '').split(','))].filter((k) => HOTEL_KEY.test(k)).slice(0, 40);
  const checkin = p.get('in') || '';
  const checkout = p.get('out') || '';
  const bad = (error: string) =>
    new Response(JSON.stringify({ error }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (!keys.length) return bad('bad_keys');
  if (!DATE.test(checkin) || !DATE.test(checkout)) return bad('bad_dates');
  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY);
  if (nights < 1 || nights > 30 || Date.parse(checkin) < Date.now() - 2 * DAY) return bad('bad_dates');
  // Children without ages still get prices: Xotelo prices the adults only.
  const parsed = parseGuests(p);
  const guests: Guests = 'error' in parsed ? (parseGuests(new URLSearchParams({ a: p.get('a') || '2', r: p.get('r') || '1' })) as Guests) : parsed;
  const rate = await usdToIls();
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      await Promise.all(
        keys.map(async (key) => {
          let offers: unknown[] = [];
          try {
            offers = await hotelOffers(key, { checkin, checkout, adults: guests.adults, rooms: guests.rooms }, rate);
          } catch (e) {
            console.error('prices', key, (e as Error).message);
          }
          ctrl.enqueue(enc.encode(JSON.stringify({ key, offers }) + '\n'));
        }),
      );
      ctrl.close();
    },
  });
  return new Response(body, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
};
