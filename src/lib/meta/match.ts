// Name and distance measures used to PROPOSE cross-connector matches for a person to verify.
// A score here is not a probability that two listings are the same property; only the verified
// mapping (data/hotel-map.json) joins offers.

const GENERIC = new Set([
  'hotel', 'hotels', 'resort', 'resorts', 'spa', 'and', 'the', 'by', 'a', 'an', 'of', 'at', 'suites', 'suite',
  'inn', 'boutique', 'apartments', 'apartment', 'hostel', 'collection', 'מלון', 'ו',
]);

export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !GENERIC.has(w))
    .join(' ');
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams of the normalized names: 1 = same, 0 = nothing shared. */
export function nameSimilarity(a: string, b: string): number {
  const x = bigrams(normalizeName(a));
  const y = bigrams(normalizeName(b));
  if (!x.length || !y.length) return normalizeName(a) === normalizeName(b) && normalizeName(a) !== '' ? 1 : 0;
  const pool = new Map<string, number>();
  for (const g of x) pool.set(g, (pool.get(g) ?? 0) + 1);
  let shared = 0;
  for (const g of y) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      shared++;
      pool.set(g, n - 1);
    }
  }
  return (2 * shared) / (x.length + y.length);
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const STRONG_MATCH = { maxMetres: 80, minName: 0.82 };
