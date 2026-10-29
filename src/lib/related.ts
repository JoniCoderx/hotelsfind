// "More guides" under a guide: the same destination first, then the same region (Israel or abroad), then the
// rest, each group in the guides' own order (newest first).

interface G {
  slug: string;
  dest?: string;
}

export function relatedGuides<T extends G>(g: T, all: T[], regionOf: (dest?: string) => string, n = 3): T[] {
  const rank = (x: T) => (x.dest && x.dest === g.dest ? 0 : regionOf(x.dest) === regionOf(g.dest) ? 1 : 2);
  return all
    .filter((x) => x.slug !== g.slug)
    .map((x, i) => ({ x, r: rank(x), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, n)
    .map((e) => e.x);
}
