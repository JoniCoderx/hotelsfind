// One canonical query string per search, built the same way in the browser and on the server.
// The CDN caches /api/search by its full URL, so junk or reordered params must not mint new
// cache entries (each one would be a fresh call against our Agoda quota).

const KEYS = ['slug', 'q', 'd', 'in', 'out', 'a', 'c', 'ages', 'r', 'sort', 'stars', 'score', 'min', 'max', 'deal', 'deep'] as const;

export function canonicalSearch(p: URLSearchParams | Record<string, string>): string {
  const src = p instanceof URLSearchParams ? p : new URLSearchParams(p);
  const out = new URLSearchParams();
  for (const k of KEYS) {
    const v = src.get(k);
    if (v !== null && v !== '') out.set(k, v);
  }
  return out.toString();
}
