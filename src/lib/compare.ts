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
