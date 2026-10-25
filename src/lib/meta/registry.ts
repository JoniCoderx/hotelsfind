// Which comparison providers this deployment can use, from environment variables.
// A provider without credentials is listed as not configured; nothing stands in for it.

import { catalog } from '../catalog';
import type { Mapping } from './match';
import { agodaLite } from './providers/agoda-lite';
import { makeAgodaSearch } from './providers/agoda-search';
import { makeBookingDemand, type BookingContent } from './providers/booking-demand';
import type { Provider } from './types';

const env = (k: string) => process.env[k] || undefined;

// Booking property content (name, coordinates, stars) per destination, fetched from
// /accommodations/details by a script once we have Demand API access. Static content may be cached.
const bookingFiles = import.meta.glob<Record<string, BookingContent>>('../../data/booking-content/*.json', {
  eager: true,
  import: 'default',
});
const bookingContent = new Map<number, BookingContent>();
for (const list of Object.values(bookingFiles)) for (const [id, c] of Object.entries(list)) bookingContent.set(Number(id), c);

const agodaById = new Map(Object.values(catalog).flat().map((h) => [h.id, h]));

export const agodaSearch = makeAgodaSearch({
  endpoint: () => env('AGODA_SEARCH_ENDPOINT'),
  siteId: () => env('AGODA_SITE_ID'),
  apiKey: () => env('AGODA_API_KEY'),
  hotelIds: (slug) => (catalog[slug] ?? []).map((h) => h.id),
  content: (id) => {
    const h = agodaById.get(id);
    return h && { name: h.nameEn, lat: h.lat, lng: h.lng, stars: h.stars };
  },
});

export const bookingDemand = makeBookingDemand({
  baseUrl: () => env('BOOKING_API_BASE'),
  token: () => env('BOOKING_API_TOKEN'),
  affiliateId: () => env('BOOKING_AFFILIATE_ID'),
  content: (id) => bookingContent.get(id),
});

/** Providers for a comparison search. Agoda Lite is used only when Search API 2.0 isn't set up. */
export function comparisonProviders(): Provider[] {
  return [agodaSearch.configured() ? agodaSearch : agodaLite, bookingDemand];
}

/** Curated cross-provider hotel IDs: src/data/hotel-map.json, [{ "id": "mz-1", "agoda": 123, "booking": 456 }]. */
const mapFiles = import.meta.glob<{ id: string; [provider: string]: string | number }[]>('../../data/hotel-map.json', {
  eager: true,
  import: 'default',
});
export const hotelMapping: Mapping = new Map(
  Object.values(mapFiles)
    .flat()
    .flatMap((row) =>
      Object.entries(row)
        .filter(([k]) => k !== 'id')
        .map(([provider, pid]) => [`${provider}:${pid}`, row.id] as [string, string]),
    ),
);
