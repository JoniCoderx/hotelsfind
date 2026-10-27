// Agoda Search API 2.0 (the "Online Affiliates / MSE" model).
// Built from https://developer.agoda.com/demand/docs/json-search-api.md — NOT yet run against Agoda:
// credentials, the endpoint URL and the metaSearch feature come from Agoda after approval.
//
// - Asks for the verified hotel list by property ID (up to 100).
// - totalPayment.inclusive is per booking and already includes taxes, fees and "Mandatory" surcharges;
//   only "Excluded" surcharges (paid at the hotel) are added, never the tax breakdown again.
// - The docs define surcharges[].method as "PB" (per booking). Codes like PRPN appear on other fields; we don't
//   carry their meaning over, so any other surcharge method stops the offer from being ranked.
// - landingUrl is only returned with the metaSearch feature; rooms without it are dropped.
// - One occupancy for the whole booking (no per-room split), so uneven rooms are refused.

import type { Board, Cancellation, Connector, MappedHotel, Offer, SearchRequest } from '../types';

export interface AgodaSurcharge {
  charge: 'Mandatory' | 'Excluded';
  /** Documented as "PB" (per booking) for surcharges. */
  method?: string;
  name?: string;
  rate: { currency?: string; inclusive: number };
}

export interface AgodaRoom {
  roomId: number;
  roomName?: string;
  freeBreakfast?: boolean;
  freeCancellation?: boolean;
  totalPayment: { exclusive: number; inclusive: number; tax?: number; fees?: number };
  rate?: { currency: string };
  surcharges?: AgodaSurcharge[];
  cancellationPolicy?: { date?: { before: string; rate: { inclusive: number } }[] };
  benefits?: { benefitName: string }[];
  landingUrl?: string;
}

export interface AgodaSearchResponse {
  properties?: { propertyId: number; propertyName?: string; rooms: AgodaRoom[] }[];
}

/** Agoda takes one occupancy for the whole booking; rooms must be identical to split evenly. */
export function agodaOccupancy(req: SearchRequest): { rooms: number; adults: number; childAges: number[] } | string {
  const [first] = req.rooms;
  const same = req.rooms.every(
    (r) => r.adults === first.adults && r.childAges.slice().sort().join() === first.childAges.slice().sort().join(),
  );
  if (!same) return 'Agoda מקבלים הרכב אחד לכל ההזמנה, ולכן רק חדרים זהים';
  return { rooms: req.rooms.length, adults: first.adults * req.rooms.length, childAges: req.rooms.flatMap((r) => r.childAges) };
}

/** An "Excluded" surcharge for the whole booking, or undefined when its method isn't the documented one. */
export function excludedAmount(s: AgodaSurcharge): number | undefined {
  return s.method === 'PB' ? s.rate.inclusive : undefined;
}

function board(r: AgodaRoom): Board {
  const names = (r.benefits ?? []).map((b) => b.benefitName.toLowerCase());
  if (names.some((n) => n.includes('all inclusive'))) return 'all-inclusive';
  if (names.some((n) => n.includes('full board'))) return 'full-board';
  if (names.some((n) => n.includes('half board') || n.includes('dinner'))) return 'half-board';
  if (r.freeBreakfast || names.some((n) => n.includes('breakfast'))) return 'breakfast';
  return 'unknown';
}

function cancellation(r: AgodaRoom): Cancellation {
  if (r.freeCancellation) {
    const free = r.cancellationPolicy?.date?.find((d) => d.rate.inclusive === 0);
    return { kind: 'free', until: free?.before };
  }
  if (r.freeCancellation === false) return { kind: 'non-refundable' };
  return { kind: 'unknown' };
}

export function agodaOffers(data: AgodaSearchResponse, req: SearchRequest, rooms: number, checkedAt: string): Offer[] {
  const offers: Offer[] = [];
  for (const p of data.properties ?? []) {
    for (const r of p.rooms) {
      if (!r.landingUrl) continue;
      const currency = r.rate?.currency ?? req.currency;
      const excluded = (r.surcharges ?? []).filter((s) => s.charge === 'Excluded');
      const amounts = excluded.map((s) => (!s.rate.currency || s.rate.currency === currency ? excludedAmount(s) : undefined));
      const unknown = amounts.some((a) => a === undefined);
      const sum = amounts.reduce<number>((t, a) => t + (a ?? 0), 0);
      offers.push({
        source: 'agoda-search',
        site: { id: 'agoda', name: 'Agoda', confirmed: true },
        hotel: { id: String(p.propertyId), name: p.propertyName ?? `Agoda ${p.propertyId}` },
        roomName: r.roomName,
        rooms,
        board: board(r),
        cancellation: cancellation(r),
        price: {
          total: { amount: r.totalPayment.inclusive, currency },
          inclusive: excluded.length ? false : true,
          ...(excluded.length && !unknown ? { excluded: { amount: sum, currency } } : {}),
          ...(unknown ? { unknownMandatory: true } : {}),
        },
        url: r.landingUrl,
        checkedAt,
      });
    }
  }
  return offers;
}

export function agodaBody(req: SearchRequest, ids: number[], occ: { rooms: number; adults: number; childAges: number[] }) {
  return {
    waitTime: 6,
    criteria: {
      propertyIds: ids,
      checkIn: req.checkin,
      checkOut: req.checkout,
      rooms: occ.rooms,
      adults: occ.adults,
      ...(occ.childAges.length ? { children: occ.childAges.length, childrenAges: occ.childAges } : {}),
      language: 'he-il',
      currency: req.currency,
      // Agoda's userCountry is the guest's nationality, not where they are browsing from.
      userCountry: req.nationality,
    },
    features: {
      ratesPerProperty: ids.length === 1 ? 25 : ids.length <= 30 ? 5 : 1,
      extra: ['content', 'metaSearch', 'surchargeDetail', 'cancellationDetail', 'benefitDetail'],
    },
  };
}

export function makeAgodaSearch(opts: {
  endpoint: () => string | undefined;
  siteId: () => string | undefined;
  apiKey: () => string | undefined;
  fetchImpl?: typeof fetch;
}): Connector {
  return {
    id: 'agoda-search',
    name: 'Agoda',
    configured: () => Boolean(opts.endpoint() && opts.siteId() && opts.apiKey()),
    async search(req, hotels: MappedHotel[], signal) {
      const occ = agodaOccupancy(req);
      if (typeof occ === 'string') return { offers: [], unsupported: occ };
      const ids = hotels.flatMap((h) => (h.agoda ? [h.agoda] : [])).slice(0, 100);
      if (!ids.length) return { offers: [], unsupported: 'אין מלונות ממופים ל-Agoda ביעד הזה' };
      const res = await (opts.fetchImpl ?? fetch)(opts.endpoint()!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip,deflate', Authorization: `${opts.siteId()}:${opts.apiKey()}` },
        body: JSON.stringify(agodaBody(req, ids, occ)),
        signal,
      });
      if (!res.ok) throw new Error(`Agoda search ${res.status}`);
      return { offers: agodaOffers((await res.json()) as AgodaSearchResponse, req, occ.rooms, new Date().toISOString()) };
    },
  };
}
