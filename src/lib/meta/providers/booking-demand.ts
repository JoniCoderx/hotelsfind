// Booking.com Demand API 3.2 ("search, look and redirect") as a comparison provider.
// Built from https://developers.booking.com/demand/docs/accommodations/search-for-available-properties
// and the prices guide — NOT yet run against Booking: access needs Managed Affiliate status.
//
// - Guests are sent per room (allocation), so uneven rooms and child ages are supported.
// - Price: `total` = what the traveller pays (book price + excluded, non-conditional charges). Booking says
//   never to cache prices, so this provider's offers must not be cached.
// - Search results carry no hotel name or coordinates; those come from /accommodations/details (static
//   content, cacheable), passed in here as `content`.

import type { Offer, Provider, SearchRequest } from '../types';

type Amount = number | { accommodation_currency?: number; booker_currency?: number | null };

export interface BookingProduct {
  id: string;
  room?: number;
  policies?: {
    cancellation?: { type?: string; free_cancellation_until?: string | null };
    meal_plan?: { plan?: string; meals?: string[] };
  };
}

export interface BookingSearchResponse {
  data?: {
    id: number;
    currency?: { accommodation?: string; booker?: string };
    price?: { total?: Amount; book?: Amount; display?: Amount };
    url?: string;
    deep_link_url?: string;
    products?: BookingProduct[];
  }[];
}

export interface BookingContent {
  name: string;
  lat?: number;
  lng?: number;
  stars?: number;
}

const amount = (a: Amount | undefined, booker: boolean) =>
  a == null ? undefined : typeof a === 'number' ? a : booker ? (a.booker_currency ?? undefined) : a.accommodation_currency;

// Meal-plan and cancellation type values below are our reading of the docs and still need checking
// against the API reference. Anything unrecognised becomes 'unknown', never a guessed label.
const BOARD: Record<string, Offer['board']> = {
  breakfast_included: 'breakfast',
  half_board: 'half-board',
  full_board: 'full-board',
  all_inclusive: 'all-inclusive',
  no_plan: 'room-only',
};

export function bookingOffers(
  data: BookingSearchResponse,
  req: SearchRequest,
  content: (id: number) => BookingContent | undefined,
  label: (url: string) => string,
  checkedAt: string,
): Offer[] {
  const offers: Offer[] = [];
  for (const h of data.data ?? []) {
    const bookerTotal = amount(h.price?.total, true);
    const total = bookerTotal ?? amount(h.price?.total, false);
    const currency = bookerTotal != null ? h.currency?.booker : h.currency?.accommodation;
    const link = h.url ?? h.deep_link_url;
    if (total == null || !currency || !link) continue;
    const c = content(h.id);
    // The listed price is for the property's cheapest product; describe that product's terms.
    const product = h.products?.[0];
    const cancel = product?.policies?.cancellation;
    offers.push({
      provider: 'booking',
      hotel: { id: String(h.id), name: c?.name ?? `Booking ${h.id}`, lat: c?.lat, lng: c?.lng, stars: c?.stars },
      rooms: req.rooms.length,
      board: BOARD[product?.policies?.meal_plan?.plan ?? ''] ?? 'unknown',
      cancellation:
        cancel?.type === 'free_cancellation'
          ? { kind: 'free', until: cancel.free_cancellation_until ?? undefined }
          : cancel?.type === 'non_refundable'
            ? { kind: 'non-refundable' }
            : { kind: 'unknown' },
      price: { total: { amount: total, currency }, inclusive: true },
      url: label(link),
      checkedAt,
    });
  }
  return offers;
}

export function bookingBody(req: SearchRequest) {
  const { lat, lng, radiusKm = 10 } = req.destination;
  return {
    booker: { country: 'il', platform: 'desktop' },
    checkin: req.checkin,
    checkout: req.checkout,
    coordinates: { latitude: lat, longitude: lng, radius: radiusKm },
    guests: {
      number_of_rooms: req.rooms.length,
      number_of_adults: req.rooms.reduce((n, r) => n + r.adults, 0),
      children: req.rooms.flatMap((r) => r.childAges),
      allocation: req.rooms.map((r) => ({ number_of_adults: r.adults, children: r.childAges })),
    },
    currency: req.currency,
    extras: ['products', 'extra_charges'],
    sort: { by: 'price', direction: 'ascending' },
    rows: 100,
  };
}

export function makeBookingDemand(opts: {
  baseUrl: () => string | undefined;
  token: () => string | undefined;
  affiliateId: () => string | undefined;
  content: (id: number) => BookingContent | undefined;
  fetchImpl?: typeof fetch;
}): Provider {
  return {
    id: 'booking',
    name: 'Booking.com',
    configured: () => Boolean(opts.baseUrl() && opts.token() && opts.affiliateId()),
    async search(req, signal) {
      if (req.destination.lat == null || req.destination.lng == null) return { offers: [], unsupported: 'אין קואורדינטות ליעד' };
      const res = await (opts.fetchImpl ?? fetch)(`${opts.baseUrl()}/accommodations/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.token()}`,
          'X-Affiliate-Id': opts.affiliateId()!,
        },
        body: JSON.stringify(bookingBody(req)),
        signal,
      });
      if (!res.ok) throw new Error(`Booking search ${res.status}`);
      // Our sub-ID goes on the clickout as `label`, per Booking's labels guide.
      const label = (url: string) => {
        const u = new URL(url);
        u.searchParams.set('label', `malonzol-${req.source}`);
        if (!u.searchParams.get('aid')) u.searchParams.set('aid', opts.affiliateId()!);
        return u.toString();
      };
      return { offers: bookingOffers((await res.json()) as BookingSearchResponse, req, opts.content, label, new Date().toISOString()) };
    },
  };
}
