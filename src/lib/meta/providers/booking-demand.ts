// Booking.com Demand API 3.2 ("search, look and redirect").
// Built from developers.booking.com (search, prices guide) — NOT yet run against Booking:
// access needs Managed Affiliate status.
//
// - Asks for the verified hotel list by accommodation ID (up to 100), guests per room with child ages,
//   and the booker's country and platform (Booking prices by country and device).
// - Price: `total` = book price + excluded non-conditional charges. An "incalculable" excluded charge has
//   no amount and is not in `total`, so such offers get no all-in price. Conditional charges aren't mandatory.
//   Without the charge breakdown we can't rule that out, so the price is treated as unknown.
// - Booking forbids caching prices: nothing from here is stored.
// - The clickout URL is returned as-is; our label is added per click by the caller.

import type { Connector, MappedHotel, Offer, SearchRequest } from '../types';

type Amount = number | { accommodation_currency?: number | null; booker_currency?: number | null };

export interface BookingCharge {
  charge?: number;
  mode?: string;
  total_amount?: number | null;
}

export interface BookingPrice {
  total?: Amount;
  book?: Amount;
  extra_charges?: { included?: BookingCharge[]; excluded?: BookingCharge[]; conditional?: BookingCharge[] };
}

export interface BookingProduct {
  id: string;
  price?: BookingPrice;
  policies?: {
    cancellation?: { type?: string; free_cancellation_until?: string | null };
    meal_plan?: { plan?: string; meals?: string[] };
  };
}

export interface BookingSearchResponse {
  data?: {
    id: number;
    currency?: { accommodation?: string; booker?: string };
    price?: BookingPrice;
    url?: string;
    deep_link_url?: string;
    products?: BookingProduct[];
  }[];
}

const amount = (a: Amount | undefined, booker: boolean) =>
  a == null ? undefined : typeof a === 'number' ? a : ((booker ? a.booker_currency : a.accommodation_currency) ?? undefined);

// Meal-plan and cancellation type values are our reading of the docs and still need checking against the
// API reference. Anything unrecognised becomes 'unknown', never a guessed label.
const BOARD: Record<string, Offer['board']> = {
  breakfast_included: 'breakfast',
  half_board: 'half-board',
  full_board: 'full-board',
  all_inclusive: 'all-inclusive',
  no_plan: 'room-only',
};

export function bookingOffers(data: BookingSearchResponse, req: SearchRequest, names: (id: number) => string | undefined, checkedAt: string): Offer[] {
  const offers: Offer[] = [];
  for (const h of data.data ?? []) {
    // The listed price belongs to the property's cheapest product; describe that product's terms.
    const product = h.products?.[0];
    const price = product?.price ?? h.price;
    const bookerTotal = amount(price?.total, true);
    const total = bookerTotal ?? amount(price?.total, false);
    const currency = bookerTotal != null ? h.currency?.booker : h.currency?.accommodation;
    const link = h.url ?? h.deep_link_url;
    if (total == null || !currency || !link) continue;
    const charges = price?.extra_charges;
    const unknownMandatory = (charges?.excluded ?? []).some((c) => c.mode === 'incalculable' || c.total_amount == null);
    const conditional = (charges?.conditional ?? []).length > 0;
    const cancel = product?.policies?.cancellation;
    offers.push({
      source: 'booking-demand',
      site: { id: 'booking', name: 'Booking.com', confirmed: true },
      hotel: { id: String(h.id), name: names(h.id) ?? `Booking ${h.id}` },
      rooms: req.rooms.length,
      board: BOARD[product?.policies?.meal_plan?.plan ?? ''] ?? 'unknown',
      cancellation:
        cancel?.type === 'free_cancellation'
          ? { kind: 'free', until: cancel.free_cancellation_until ?? undefined }
          : cancel?.type === 'non_refundable'
            ? { kind: 'non-refundable' }
            : { kind: 'unknown' },
      // Without the charge breakdown we can't tell whether an incalculable charge is missing.
      price: charges
        ? { total: { amount: total, currency }, inclusive: true, ...(unknownMandatory ? { unknownMandatory } : {}), ...(conditional ? { conditional } : {}) }
        : { total: { amount: total, currency }, inclusive: null },
      url: link,
      checkedAt,
    });
  }
  return offers;
}

export function bookingBody(req: SearchRequest, ids: number[]) {
  return {
    booker: { country: req.userCountry.toLowerCase(), platform: req.device },
    checkin: req.checkin,
    checkout: req.checkout,
    accommodations: ids,
    guests: {
      number_of_rooms: req.rooms.length,
      number_of_adults: req.rooms.reduce((n, r) => n + r.adults, 0),
      children: req.rooms.flatMap((r) => r.childAges),
      allocation: req.rooms.map((r) => ({ number_of_adults: r.adults, children: r.childAges })),
    },
    currency: req.currency,
    extras: ['products', 'extra_charges'],
    rows: 100,
  };
}

export function makeBookingDemand(opts: {
  baseUrl: () => string | undefined;
  token: () => string | undefined;
  affiliateId: () => string | undefined;
  fetchImpl?: typeof fetch;
}): Connector {
  return {
    id: 'booking-demand',
    name: 'Booking.com',
    configured: () => Boolean(opts.baseUrl() && opts.token() && opts.affiliateId()),
    async search(req, hotels: MappedHotel[], signal) {
      const ids = hotels.flatMap((h) => (h.booking ? [h.booking] : [])).slice(0, 100);
      if (!ids.length) return { offers: [], unsupported: 'אין מלונות ממופים ל-Booking ביעד הזה' };
      const res = await (opts.fetchImpl ?? fetch)(`${opts.baseUrl()}/accommodations/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token()}`, 'X-Affiliate-Id': opts.affiliateId()! },
        body: JSON.stringify(bookingBody(req, ids)),
        signal,
      });
      if (!res.ok) throw new Error(`Booking search ${res.status}`);
      const names = (id: number) => hotels.find((h) => h.booking === id)?.name;
      return { offers: bookingOffers((await res.json()) as BookingSearchResponse, req, names, new Date().toISOString()) };
    },
  };
}
