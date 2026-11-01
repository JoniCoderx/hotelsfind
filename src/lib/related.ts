// "More guides" under a guide: guides about the same place first (its destination, or a multi-destination guide that
// covers it), then guides of the same kind in the same region ("where to stay in" another city), then the same region
// (Israel or abroad), then the rest, each group in the guides' own order (newest first).

interface G {
  slug: string;
  dest?: string;
  sections?: { dests?: string[] }[];
}

const kind = (slug: string) => (slug.startsWith('where-to-stay-') ? 'where' : 'topic');
const places = (x: G) => new Set([x.dest, ...(x.sections ?? []).flatMap((s) => s.dests ?? [])].filter(Boolean));

export function relatedGuides<T extends G>(g: T, all: T[], regionOf: (dest?: string) => string, n = 3): T[] {
  const mine = places(g);
  const rank = (x: T) => {
    if ([...places(x)].some((p) => mine.has(p))) return 0;
    const sameRegion = regionOf(x.dest) === regionOf(g.dest);
    if (sameRegion && kind(x.slug) === kind(g.slug)) return 1;
    return sameRegion ? 2 : 3;
  };
  return all
    .filter((x) => x.slug !== g.slug)
    .map((x, i) => ({ x, r: rank(x), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, n)
    .map((e) => e.x);
}
