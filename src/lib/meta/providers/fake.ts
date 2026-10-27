// Test connectors for building the comparison UI locally. Enabled only by META_FAKE=1 outside production;
// every hotel name says "(בדיקה)" so a screenshot can never pass for real prices.

import { devSamplesAllowed } from '../../mode';
import type { Connector, MappedHotel, Offer, SearchRequest } from '../types';

export function fakeAllowed(): boolean {
  return devSamplesAllowed('META_FAKE');
}

/** A verified-looking mapping for any destination, for local UI work only. */
export function fakeHotels(slug: string): MappedHotel[] {
  return ['Coral Bay Resort', 'Marina Suites', 'Sunrise Palace', 'Garden Boutique'].map((name, i) => ({
    id: `fake-${slug}-${i}`,
    slug,
    name: `${name} (בדיקה)`,
    stars: 3 + (i % 3),
    agoda: 1000 + i,
    booking: 2000 + i,
    verified: { by: 'fake', at: '2026-10-26' },
  }));
}

function offers(site: 'agoda' | 'booking', req: SearchRequest, hotels: MappedHotel[]): Offer[] {
  const nights = Math.round((Date.parse(req.checkout) - Date.parse(req.checkin)) / 86_400_000);
  return hotels.map((h, i) => {
    const perNight = 420 + i * 160 + (site === 'booking' ? (i % 2 ? -35 : 45) : 0);
    const total = Math.round(perNight * nights);
    return {
      source: site === 'agoda' ? 'agoda-search' : 'booking-demand',
      site: { id: site, name: site === 'agoda' ? 'Agoda' : 'Booking.com', confirmed: true },
      hotel: { id: String(site === 'agoda' ? h.agoda : h.booking), name: h.name },
      roomName: site === 'booking' ? 'Double Room' : 'Deluxe Double',
      rooms: req.rooms.length,
      board: i % 2 ? 'room-only' : 'breakfast',
      cancellation: site === 'booking' || i === 2 ? { kind: 'free', until: req.checkin } : { kind: 'non-refundable' },
      price:
        site === 'agoda' && i === 3
          ? { total: { amount: total, currency: 'ILS' }, inclusive: false, excluded: { amount: 60 * nights, currency: 'ILS' } }
          : site === 'booking' && i === 1
            ? { total: { amount: total, currency: 'ILS' }, inclusive: true, unknownMandatory: true }
            : { total: { amount: total, currency: 'ILS' }, inclusive: true },
      url: `https://example.com/${site}/${i}`,
      checkedAt: new Date().toISOString(),
    };
  });
}

export const fakeConnectors: Connector[] = (['agoda', 'booking'] as const).map((site) => ({
  id: site === 'agoda' ? 'agoda-search' : 'booking-demand',
  name: site === 'agoda' ? 'Agoda' : 'Booking.com',
  configured: () => true,
  search: async (req, hotels) => ({ offers: offers(site, req, hotels) }),
}));
