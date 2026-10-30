// Hotel catalog imported from Agoda's Hotel Data File (scripts/agoda-import.mjs).
// Empty until the import has run; pages that use it simply render without it.

export interface CatalogHotel {
  id: number;
  name: string;
  nameEn: string;
  city: string;
  stars: number;
  score: number;
  reviews: number;
  photo: string;
  address: string;
  lat: number | null;
  lng: number | null;
  ratesFrom: number | null;
  ratesCurrency: string | null;
  overview: string;
}

import { geo } from '../data/geo';

const files = import.meta.glob<CatalogHotel[]>('../data/catalog/*.json', { eager: true, import: 'default' });

// Islands and regions: the whole of it counts.
const WHOLE = new Set(['crete', 'cyprus', 'rhodes']);

/**
 * Whether a hotel is at the destination we mean. Agoda's "city" can reach well past it: its Dead Sea holds the
 * Jordanian shore (60 km away, another country), its Tel Aviv and Netanya a few places far off.
 */
export function atDestination(slug: string, h: Pick<CatalogHotel, 'lat' | 'lng'>): boolean {
  const g = geo[slug];
  if (!g || WHOLE.has(slug) || h.lat == null || h.lng == null) return true;
  const r = Math.PI / 180;
  const d = Math.hypot((h.lng - g.lng) * r * Math.cos(((h.lat + g.lat) / 2) * r), (h.lat - g.lat) * r) * 6371;
  return d <= Math.max(4 * g.radiusKm, 32);
}

export const catalog: Record<string, CatalogHotel[]> = Object.fromEntries(
  Object.entries(files).map(([path, list]) => {
    const slug = path.split('/').pop()!.replace('.json', '');
    return [slug, list.filter((h) => atDestination(slug, h))];
  }),
);
