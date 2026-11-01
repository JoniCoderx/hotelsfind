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

/** The same hotel listed twice by the price source (a renamed hotel keeps its old listing): exactly the same name
 *  and under 250 m apart. A name alone isn't enough: chains reuse names across a city. */
export function sameProperty(
  a: { name: string; lat?: number | null; lng?: number | null },
  b: { name: string; lat?: number | null; lng?: number | null },
): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (norm(a.name) !== norm(b.name)) return false;
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false;
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371 < 0.25;
}

/** New rows without the ones already listed (or listed twice in this page); the listing with more reviews stays. */
export function dropDuplicates<T extends { name: string; reviews?: number; lat?: number | null; lng?: number | null }>(have: T[], fresh: T[]): T[] {
  const out: T[] = [];
  for (const r of [...fresh].sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))) {
    if (have.some((h) => sameProperty(h, r)) || out.some((h) => sameProperty(h, r))) continue;
    out.push(r);
  }
  // Keep the page's own order.
  return fresh.filter((r) => out.includes(r));
}
