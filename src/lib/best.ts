// "Recommended hotels" lists, ranked from Agoda's hotel data (src/data/catalog): guest score weighted by
// how many reviews back it, so a 9.4 from 12 guests doesn't outrank a 9.0 from 3,000.
import type { CatalogHotel } from './catalog';

export type ListKind = 'top' | 'luxury' | 'value';

export interface RankedHotel extends CatalogHotel {
  rank: number;
  /** Kilometres from the median hotel location; only for compact destinations (a city, not a region). */
  km: number | null;
  /** Why it stands out on this list, if it does. */
  badge: string | null;
}

export interface HotelList {
  kind: ListKind;
  hotels: RankedHotel[];
}

const PRIOR_SCORE = 7.5; // what an unreviewed hotel is assumed to score
const PRIOR_WEIGHT = 200; // how many reviews it takes to outweigh that assumption
export const MIN_LIST = 6;
const MAX_LIST = 12;

export const weighted = (h: Pick<CatalogHotel, 'score' | 'reviews'>) =>
  (h.score * h.reviews + PRIOR_SCORE * PRIOR_WEIGHT) / (h.reviews + PRIOR_WEIGHT);

// Destinations that are a region (several towns), where "distance from the centre" means nothing.
const REGIONS = new Set(['dead-sea', 'cyprus', 'crete', 'rhodes']);
const NOT_HOTEL = /hostel|camping|capsule|dorm/i;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
}

/** The middle of a destination's hotels, or null when they are spread over a region (Crete, Cyprus...). */
export function centre(all: CatalogHotel[]) {
  const geo = all.filter((h) => h.lat && h.lng) as (CatalogHotel & { lat: number; lng: number })[];
  if (geo.length < 10) return null;
  const c = { lat: median(geo.map((h) => h.lat)), lng: median(geo.map((h) => h.lng)) };
  return median(geo.map((h) => km(c, h))) <= 4 ? c : null;
}

const FILTERS: Record<ListKind, (h: CatalogHotel) => boolean> = {
  top: (h) => h.score >= 7,
  luxury: (h) => h.stars >= 4.5 && h.score >= 7.5,
  value: (h) => h.stars > 0 && h.stars <= 3 && h.score >= 7.5,
};

export function rankList(all: CatalogHotel[], kind: ListKind, slug = ''): HotelList | null {
  const c = REGIONS.has(slug) ? null : centre(all);
  const picked = all
    .filter((h) => h.photo && h.reviews >= 30 && !NOT_HOTEL.test(h.nameEn) && FILTERS[kind](h))
    .sort((a, b) => weighted(b) - weighted(a))
    .slice(0, MAX_LIST);
  if (picked.length < MIN_LIST) return null;
  const hotels: RankedHotel[] = picked.map((h, i) => ({
    ...h,
    photo: h.photo.replace('s=312x', 's=800x'),
    rank: i + 1,
    km: c && h.lat && h.lng ? Math.round(km(c, h as { lat: number; lng: number }) * 10) / 10 : null,
    badge: null,
  }));
  // Mark what makes some of them stand out, once each.
  const mark = (h: RankedHotel | undefined, badge: string) => h && !h.badge && (h.badge = badge);
  mark([...hotels].sort((a, b) => b.score - a.score)[0], 'הציון הגבוה ברשימה');
  mark([...hotels].sort((a, b) => b.reviews - a.reviews)[0], 'הכי הרבה ביקורות');
  if (c) mark([...hotels].filter((h) => h.km !== null).sort((a, b) => a.km! - b.km!)[0], 'הכי קרוב למרכז');
  return { kind, hotels };
}

export function listsFor(all: CatalogHotel[] | undefined, slug = ''): HotelList[] {
  if (!all?.length) return [];
  return (['top', 'luxury', 'value'] as const).map((k) => rankList(all, k, slug)).filter((x): x is HotelList => !!x);
}

export const listPath = (slug: string, kind: ListKind) => (kind === 'top' ? `/best/${slug}/` : `/best/${slug}/${kind}/`);

export const listTitle = (kind: ListKind, he: string) =>
  ({ top: `המלונות המומלצים ב${he}`, luxury: `מלונות יוקרה מומלצים ב${he}`, value: `מלונות משתלמים ומומלצים ב${he}` })[kind];
