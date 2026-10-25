// Agoda Search API 2.0 (the "Online Affiliates / MSE" model) as a comparison provider.
// Built from https://developer.agoda.com/demand/docs/json-search-api.md — NOT yet run against Agoda:
// credentials, the endpoint URL and the metaSearch feature come from Agoda after approval.
//
// - Searches by property IDs (up to 100), so a destination needs its Agoda hotel IDs from the content feed.
// - Price: totalPayment.inclusive is per booking and includes taxes, fees and "Mandatory" surcharges;
//   "Excluded" surcharges are paid at the hotel and must be added for an all-in comparison.
// - landingUrl is only returned with the metaSearch feature.
// - Occupancy is one total for the booking (no per-room split), so uneven rooms are refused.

import type { Board, Cancellation, Offer, Provider, SearchRequest } from '../types';

export interface AgodaRoom {
  roomId: number;
  roomName?: string;
  freeBreakfast?: boolean;
  freeCancellation?: boolean;
  totalPayment: { exclusive: number; inclusive: number; tax?: number; fees?: number };
  rate?: { currency: string };
  surcharges?: { charge: 'Mandatory' | 'Excluded'; method?: string; name?: string; rate: { currency?: string; inclusive: number } }[];
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

/** Static facts about an Agoda hotel from the content feed, used for matching only (clause 4.8.2: no Agoda photos or texts). */
export type AgodaContent = (id: number) => { name?: string; lat?: number | null; lng?: number | null; stars?: number } | undefined;

export function agodaOffers(
  data: AgodaSearchResponse,
  req: SearchRequest,
  rooms: number,
  checkedAt: string,
  content: AgodaContent = () => undefined,
): Offer[] {
  const offers: Offer[] = [];
  for (const p of data.properties ?? []) {
    for (const r of p.rooms) {
      if (!r.landingUrl) continue; // without metaSearch there is nowhere to send the traveller
      const currency = r.rate?.currency ?? req.currency;
      const excluded = (r.surcharges ?? []).filter((s) => s.charge === 'Excluded');
      const excludedSum = excluded.reduce((sum, s) => sum + s.rate.inclusive, 0);
      const excludedCurrencyKnown = excluded.every((s) => !s.rate.currency || s.rate.currency === currency);
      const c = content(p.propertyId);
      offers.push({
        provider: 'agoda',
        hotel: {
          id: String(p.propertyId),
          name: p.propertyName ?? c?.name ?? `Agoda ${p.propertyId}`,
          lat: c?.lat ?? undefined,
          lng: c?.lng ?? undefined,
          stars: c?.stars,
        },
        roomName: r.roomName,
        rooms,
        board: board(r),
        cancellation: cancellation(r),
        price: {
          total: { amount: r.totalPayment.inclusive, currency },
          // Mandatory surcharges are inside `inclusive`; excluded ones are paid at the hotel.
          inclusive: excluded.length ? (excludedCurrencyKnown ? false : null) : true,
          ...(excluded.length && excludedCurrencyKnown ? { excluded: { amount: excludedSum, currency } } : {}),
        },
        url: r.landingUrl,
        checkedAt,
      });
    }
  }
  return offers;
}

export function makeAgodaSearch(opts: {
  endpoint: () => string | undefined;
  siteId: () => string | undefined;
  apiKey: () => string | undefined;
  /** Agoda hotel IDs for a destination, from the content feed. */
  hotelIds: (slug: string) => number[];
  content?: AgodaContent;
  fetchImpl?: typeof fetch;
}): Provider {
  return {
    id: 'agoda',
    name: 'Agoda',
    configured: () => Boolean(opts.endpoint() && opts.siteId() && opts.apiKey()),
    async search(req, signal) {
      const occ = agodaOccupancy(req);
      if (typeof occ === 'string') return { offers: [], unsupported: occ };
      const ids = opts.hotelIds(req.destination.slug).slice(0, 100);
      if (!ids.length) return { offers: [], unsupported: 'אין עדיין רשימת מלונות של Agoda ליעד הזה' };
      const body = {
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
          userCountry: 'IL',
        },
        features: {
          ratesPerProperty: ids.length === 1 ? 25 : ids.length <= 30 ? 5 : 1,
          extra: ['content', 'metaSearch', 'surchargeDetail', 'cancellationDetail', 'benefitDetail'],
        },
      };
      const res = await (opts.fetchImpl ?? fetch)(opts.endpoint()!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip,deflate', Authorization: `${opts.siteId()}:${opts.apiKey()}` },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) throw new Error(`Agoda search ${res.status}`);
      return {
        offers: agodaOffers((await res.json()) as AgodaSearchResponse, req, occ.rooms, new Date().toISOString(), opts.content),
      };
    },
  };
}
