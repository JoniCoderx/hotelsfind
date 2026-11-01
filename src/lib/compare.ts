// Small rules of the price comparison, kept here so they can be tested: the order of the list, which sites tie for
// the lowest price, and which Thursday a "weekend" starts on.

/** Cheapest first (rows without a price last), ties in their original order. */
export function byPrice<T extends { order: number }>(rows: T[], priceOf: (r: T) => number): T[] {
  return [...rows].sort((a, b) => (priceOf(a) || Infinity) - (priceOf(b) || Infinity) || a.order - b.order);
}

/** Every offer at the lowest price (offers come cheapest first); more than one when sites tie. */
export function tiedCheapest<O extends { price: number }>(offers: O[]): O[] {
  return offers.length ? offers.filter((o) => o.price === offers[0].price) : [];
}

/** The first Thursday at least `minDays` days after `now` (a weekend's check-in). */
export function thursdayFrom(now: Date, minDays: number): Date {
  const from = new Date(now.getTime() + minDays * 86_400_000);
  return new Date(from.getTime() + ((4 - from.getDay() + 7) % 7) * 86_400_000);
}

/**
 * TripAdvisor listings that are one hotel, checked by hand: listing key → the key whose card shows the hotel. Each
 * entry needs evidence that it is the same property; a matching name or nearby coordinates alone are not enough.
 * - Neptune Eilat: d308942 is the old Rimonim Eilat listing (Rimonim's Eilat hotel joined Dan Hotels as Neptune in
 *   2019; Expedia lists "Rimonim Eilat" as a former name; Agoda still has it as Rimonim Eilat, North Shore, PO Box 259)
 *   and d23277058 the new Neptune listing. They carry different sellers (Booking and Agoda on one, Trip.com on the
 *   other), so the card keeps both listings' offers.
 */
export const SAME_HOTEL: Record<string, string> = {
  'g293980-d23277058': 'g293980-d308942',
};

/** Two listings' offers on one card: each site's cheapest, cheapest first. Nothing either listing offered is lost. */
export function mergeOffers<O extends { site: string; price: number }>(a: O[], b: O[]): O[] {
  const best = new Map<string, O>();
  for (const o of [...a, ...b]) if (!best.has(o.site) || o.price < best.get(o.site)!.price) best.set(o.site, o);
  return [...best.values()].sort((x, y) => x.price - y.price);
}

/**
 * Rows with each mapped listing folded into its hotel's card: the card lists the other key in `alts` (so its prices
 * are fetched too) and takes any offers it already has. A mapped listing whose hotel isn't in the list stays on its own.
 */
export function foldListings<R extends { key: string; alts?: string[]; prices?: { site: string; price: number }[] }>(have: R[], fresh: R[]): { have: R[]; fresh: R[] } {
  const all = [...have, ...fresh];
  const gone = new Set<string>();
  for (const r of all) {
    const target = SAME_HOTEL[r.key] && all.find((x) => x.key === SAME_HOTEL[r.key]);
    if (!target) continue;
    target.alts = [...new Set([...(target.alts ?? []), r.key])];
    if (r.prices) target.prices = mergeOffers(target.prices ?? [], r.prices);
    gone.add(r.key);
  }
  return { have: have.filter((r) => !gone.has(r.key)), fresh: fresh.filter((r) => !gone.has(r.key)) };
}
