// Which connectors this deployment can use, the verified hotel list, and per-click attribution.
// A connector without credentials is listed as not configured; nothing stands in for it.

import mapFile from '../../data/hotel-map.json';
import { fakeAllowed, fakeConnectors, fakeHotels } from './providers/fake';
import { makeAgodaSearch } from './providers/agoda-search';
import { makeBookingDemand } from './providers/booking-demand';
import { makeVio } from './providers/vio';
import type { Connector, MappedHotel, Offer } from './types';

const env = (k: string) => process.env[k] || undefined;

export const agodaSearch = makeAgodaSearch({
  endpoint: () => env('AGODA_SEARCH_ENDPOINT'),
  siteId: () => env('AGODA_SITE_ID'),
  apiKey: () => env('AGODA_API_KEY'),
});

export const bookingDemand = makeBookingDemand({
  baseUrl: () => env('BOOKING_API_BASE'),
  token: () => env('BOOKING_API_TOKEN'),
  affiliateId: () => env('BOOKING_AFFILIATE_ID'),
});

export const vio = makeVio({ key: () => env('VIO_PARTNER_KEY') });

/**
 * Connectors whose price meaning was confirmed with the provider and checked on real answers and landing pages
 * (PRICE_VERIFIED=agoda-search,vio). Offers from any other connector are shown, never ranked.
 */
export function priceVerified(): Set<string> {
  if (fakeAllowed()) return new Set(['agoda-search', 'booking-demand']);
  return new Set((env('PRICE_VERIFIED') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
}

export function comparisonConnectors(): Connector[] {
  return fakeAllowed() ? fakeConnectors : [agodaSearch, bookingDemand, vio];
}

/** Verified hotels for a destination: src/data/hotel-map.json (see docs/hotel-mapping.md). */
export function mappedHotels(slug: string): MappedHotel[] {
  if (fakeAllowed()) return fakeHotels(slug);
  return (mapFile as MappedHotel[]).filter((h) => h.slug === slug && h.verified?.at);
}

/**
 * Our attribution for one click, added per response so searches that shared a connector call
 * still carry their own campaign. `src` is our placement/campaign label, already sanitised.
 */
export function attribute(o: Offer, src: string): string {
  try {
    const u = new URL(o.url);
    if (o.source === 'booking-demand') {
      u.searchParams.set('label', `malonzol-${src}`);
      const aid = env('BOOKING_AFFILIATE_ID');
      if (aid && !u.searchParams.get('aid')) u.searchParams.set('aid', aid);
    } else if (o.source === 'vio') {
      u.searchParams.set('click_label', src);
    }
    return u.toString();
  } catch {
    return o.url;
  }
}
