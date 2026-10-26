// Fair ranking: one number per offer — the whole stay, all rooms, in one currency, including mandatory charges.
// An offer whose all-in price can't be established is shown but never ranked, and a hotel's offer is only
// called the cheapest when complete prices from at least two different booking sites were compared.

import type { Offer } from './types';

/** Exchange rate lookup: `to` per one `from`, with when the rate was published. */
export type Fx = (from: string, to: string) => { rate: number; at: string } | undefined;

export interface Comparable {
  /** All-in total in the request currency, or null when it can't be established. */
  amount: number | null;
  /** Why `amount` is null, in Hebrew for the UI. */
  why?: string;
  /** Set when converted: the original currency, the rate and its date. */
  fx?: { from: string; rate: number; at: string };
}

export function comparable(o: Offer, currency: string, fx: Fx, roomsRequested: number): Comparable {
  const { total, inclusive, excluded, unknownMandatory } = o.price;
  if (o.rooms !== roomsRequested) return { amount: null, why: `ההצעה ל-${o.rooms} חדרים ולא ל-${roomsRequested}` };
  if (unknownMandatory) return { amount: null, why: 'יש תשלום חובה שהסכום שלו לא ידוע' };
  if (inclusive === null) return { amount: null, why: 'האתר לא מפרט אם המחיר כולל מיסים' };
  if (inclusive === false && !excluded) return { amount: null, why: 'המחיר לא כולל מיסים, והסכום שלהם לא ידוע' };
  const parts = [total, ...(inclusive === false && excluded ? [excluded] : [])];
  let sum = 0;
  let conv: Comparable['fx'];
  for (const m of parts) {
    if (m.currency === currency) {
      sum += m.amount;
      continue;
    }
    const r = fx(m.currency, currency);
    if (!r) return { amount: null, why: `אין שער המרה מ-${m.currency}` };
    sum += m.amount * r.rate;
    conv = { from: m.currency, rate: r.rate, at: r.at };
  }
  return { amount: Math.round(sum), ...(conv ? { fx: conv } : {}) };
}

/** Terms that must match for two offers to be like-for-like. Unknown terms never match anything. */
export function offerClass(o: Offer): string {
  const unknown = o.board === 'unknown' || o.cancellation.kind === 'unknown';
  return unknown ? `unknown:${o.source}:${o.site.id}:${o.url}` : `${o.board}|${o.cancellation.kind}|${o.rooms}`;
}

export type RankedOffer = Offer & { all: Comparable; cheapest: boolean };

export interface RankedHotel {
  offers: RankedOffer[];
  /** Booking sites with an all-in price for this hotel. */
  sitesCompared: number;
}

/** Sort a hotel's offers by all-in price; mark the cheapest only when ≥2 sites had complete prices. */
export function rankOffers(offers: Offer[], currency: string, fx: Fx, roomsRequested: number): RankedHotel {
  const ranked = offers.map((o) => ({ ...o, all: comparable(o, currency, fx, roomsRequested), cheapest: false }));
  ranked.sort((a, b) => (a.all.amount ?? Infinity) - (b.all.amount ?? Infinity));
  const sites = new Set(ranked.filter((o) => o.all.amount != null).map((o) => o.site.id));
  if (sites.size >= 2) ranked[0].cheapest = true;
  return { offers: ranked, sitesCompared: sites.size };
}
