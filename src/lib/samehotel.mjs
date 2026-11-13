// One place listed twice in the catalog: the same name at the same coordinates (an apartment Agoda lists under two
// IDs). The listing with more reviews (then the lower ID) is the page search engines get; the other points to it.
// Plain JS so astro.config.mjs can use it to keep the copies out of the sitemap.

/** @param {{ id: number; name: string; lat?: number | null; lng?: number | null; reviews?: number }[]} list */
export function copiesIn(list) {
  const groups = new Map();
  for (const h of list) {
    if (h.lat == null || h.lng == null) continue;
    const k = `${h.name.trim().toLowerCase()}|${h.lat.toFixed(5)}|${h.lng.toFixed(5)}`;
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  /** @type {Map<number, number>} copy ID -> the ID of the page it points to */
  const out = new Map();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const [main, ...rest] = [...g].sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0) || a.id - b.id);
    for (const c of rest) out.set(c.id, main.id);
  }
  return out;
}
