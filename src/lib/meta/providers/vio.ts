// Vio.com Partners API: several booking sites per hotel in one call.
// Built from developers.vio.com (/search, /search/poll, rooms configuration, dynamic click tracking) —
// NOT yet run against Vio: a profile key comes with a revenue-share agreement.
//
// - Queried by the verified hotels' names within the destination city; `requestedName` maps offers back.
// - rooms string: "2:4,6|3". We send one room for now (the engine refuses more).
// - Rate is "specified per room": base (no taxes), taxes (VAT) and hotelFees (mandatory, paid at the hotel).
//   The price filter docs compare offer prices with the whole stay, so we read rates as whole-stay
//   per room. To verify with Vio before ranking live.
// - `provider` is the distributor of the offer, "not necessarily the same as the provider selling the offer":
//   we show it as the site with "via Vio" and keep that caveat in the UI.
// - /search/poll returns `completed`; if our time runs out first, the result is marked partial.
// - Offer URLs are Vio tracking links; our per-click label goes in `click_label`.

import type { Board, Cancellation, Connector, MappedHotel, Offer, SearchRequest } from '../types';

export interface VioOffer {
  rate: { base: number; taxes: number; hotelFees: number };
  currency: string;
  provider: { name: string };
  package: { amenities: string[]; canPayLater?: boolean };
  cancellationPenalties: { start?: string; end?: string; amount?: number; nights?: number; percent?: number }[];
  roomName: string;
  url: string;
}

export interface VioResponse {
  hotels: { requestedName?: string; id?: string; offers: VioOffer[]; error?: string }[];
  sessionId?: string;
  completed?: boolean;
}

export const vioRooms = (req: SearchRequest) =>
  req.rooms.map((r) => `${r.adults}${r.childAges.length ? `:${r.childAges.join(',')}` : ''}`).join('|');

function board(amenities: string[]): Board {
  const a = new Set(amenities);
  if (a.has('allInclusive')) return 'all-inclusive';
  if (a.has('fullBoard')) return 'full-board';
  if (a.has('halfBoard')) return 'half-board';
  if (a.has('breakfast')) return 'breakfast';
  return 'unknown';
}

export function vioCancellation(p: VioOffer['cancellationPenalties'], now = Date.now()): Cancellation {
  if (!p?.length) return { kind: 'unknown' };
  const sorted = p.slice().sort((x, y) => Date.parse(x.start ?? '0') - Date.parse(y.start ?? '0'));
  const first = sorted[0];
  if (first.start && Date.parse(first.start) > now) return { kind: 'free', until: first.start };
  if ((first.percent ?? 0) >= 100) return { kind: 'non-refundable' };
  return { kind: 'partial' };
}

const siteId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function vioOffers(data: VioResponse, req: SearchRequest, checkedAt: string): Offer[] {
  const offers: Offer[] = [];
  for (const h of data.hotels ?? []) {
    if (h.error || !h.requestedName) continue;
    for (const o of h.offers ?? []) {
      const r = o.rate;
      offers.push({
        source: 'vio',
        site: { id: siteId(o.provider.name), name: o.provider.name },
        via: 'Vio',
        hotel: { id: h.requestedName, name: h.requestedName },
        roomName: o.roomName,
        rooms: req.rooms.length,
        board: board(o.package?.amenities ?? []),
        cancellation: vioCancellation(o.cancellationPenalties),
        price: {
          total: { amount: r.base + r.taxes, currency: o.currency },
          inclusive: r.hotelFees ? false : true,
          ...(r.hotelFees ? { excluded: { amount: r.hotelFees, currency: o.currency } } : {}),
        },
        url: o.url,
        checkedAt,
      });
    }
  }
  return offers;
}

export function vioBody(req: SearchRequest, names: string[]) {
  const city = req.destination.name.split(',')[0].trim();
  return {
    query: { hotelNames: { names, city, country: req.destination.country, noMappingFallback: true } },
    checkIn: req.checkin,
    checkOut: req.checkout,
    rooms: vioRooms(req),
    language: 'en',
    currency: req.currency,
    userCountry: req.userCountry,
    userDevice: req.device,
  };
}

export function makeVio(opts: { key: () => string | undefined; budgetMs?: number; fetchImpl?: typeof fetch }): Connector {
  const base = 'https://partners.api.vio.com/v1';
  return {
    id: 'vio',
    name: 'Vio.com',
    configured: () => Boolean(opts.key()),
    async search(req, hotels: MappedHotel[], signal) {
      const names = hotels.flatMap((h) => (h.vioName ? [h.vioName] : [])).slice(0, 50);
      if (!names.length) return { offers: [], unsupported: 'אין מלונות ממופים ל-Vio ביעד הזה' };
      const deadline = Date.now() + (opts.budgetMs ?? 6000);
      const body = JSON.stringify(vioBody(req, names));
      let last: VioResponse | undefined;
      let session: string | undefined;
      // Long polling: each answer holds the full set so far; stop when Vio says completed or our time is up.
      while (Date.now() < deadline) {
        const res = await (opts.fetchImpl ?? fetch)(`${base}/search/poll${session ? `?sessionId=${encodeURIComponent(session)}` : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Partner-Key': opts.key()! },
          body,
          signal,
        });
        if (!res.ok) throw new Error(`Vio search ${res.status}`);
        last = (await res.json()) as VioResponse;
        if (last.completed || !last.sessionId) break;
        session = last.sessionId;
      }
      return { offers: last ? vioOffers(last, req, new Date().toISOString()) : [], complete: Boolean(last?.completed) };
    },
  };
}
