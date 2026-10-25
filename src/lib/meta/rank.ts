// Fair ranking: one number per offer, the whole stay in one currency including mandatory charges.
// An offer whose all-in price we can't establish is still shown, but never ranked as cheapest.

import type { Offer } from './types';

/** Exchange rate lookup: how many `to` per one `from`, or undefined when unknown. */
export type Fx = (from: string, to: string) => number | undefined;

export interface Comparable {
  /** All-in total for the stay in the request currency, or null when it can't be established. */
  amount: number | null;
  /** Why `amount` is null, in Hebrew for the UI. */
  why?: string;
  converted: boolean;
}

export function comparable(o: Offer, currency: string, fx: Fx): Comparable {
  const { total, inclusive, excluded } = o.price;
  if (inclusive === null) return { amount: null, why: 'האתר לא מפרט אם המחיר כולל מיסים', converted: false };
  if (inclusive === false && !excluded) return { amount: null, why: 'המחיר לא כולל מיסים, והסכום שלהם לא ידוע', converted: false };
  const parts = [total, ...(inclusive === false && excluded ? [excluded] : [])];
  let sum = 0;
  let converted = false;
  for (const m of parts) {
    if (m.currency === currency) sum += m.amount;
    else {
      const rate = fx(m.currency, currency);
      if (!rate) return { amount: null, why: `אין שער המרה מ-${m.currency}`, converted: false };
      sum += m.amount * rate;
      converted = true;
    }
  }
  return { amount: Math.round(sum), converted };
}

/** Offers are like-for-like when meals and cancellation terms match. Room types differ by name across sites. */
export function offerClass(o: Offer): string {
  return `${o.board}|${o.cancellation.kind}|${o.rooms}`;
}

export type RankedOffer = Offer & { all: Comparable; cheapest: boolean };

/** Sort a hotel's offers by all-in price; mark the cheapest rankable one. */
export function rankOffers(offers: Offer[], currency: string, fx: Fx): RankedOffer[] {
  const ranked = offers.map((o) => ({ ...o, all: comparable(o, currency, fx), cheapest: false }));
  ranked.sort((a, b) => (a.all.amount ?? Infinity) - (b.all.amount ?? Infinity));
  if (ranked[0]?.all.amount != null) ranked[0].cheapest = true;
  return ranked;
}
