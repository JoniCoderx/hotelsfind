// Test providers for building the comparison UI locally. Enabled only by META_FAKE=1 outside production;
// every hotel name says "(בדיקה)" so a screenshot can never pass for real prices.

import { devSamplesAllowed } from '../../mode';
import type { Offer, Provider, SearchRequest } from '../types';

export function fakeAllowed(): boolean {
  return devSamplesAllowed('META_FAKE');
}

const HOTELS = [
  { name: 'Coral Bay Resort', lat: 0.002, lng: 0.001, stars: 4 },
  { name: 'Marina Suites', lat: -0.004, lng: 0.003, stars: 3 },
  { name: 'Sunrise Palace', lat: 0.006, lng: -0.002, stars: 5 },
  { name: 'Garden Boutique', lat: -0.001, lng: -0.005, stars: 4 },
];

function offers(provider: 'agoda' | 'booking', req: SearchRequest): Offer[] {
  const nights = Math.round((Date.parse(req.checkout) - Date.parse(req.checkin)) / 86_400_000);
  const base = req.destination.lat ?? 0;
  const baseLng = req.destination.lng ?? 0;
  return HOTELS.map((h, i) => {
    const perNight = 420 + i * 160 + (provider === 'booking' ? (i % 2 ? -35 : 45) : 0);
    const total = Math.round(perNight * nights * req.rooms.length);
    return {
      provider,
      hotel: {
        id: `${provider}-${i}`,
        // Booking spells names differently, as real feeds do.
        name: `${provider === 'booking' ? `${h.name} Hotel` : h.name} (בדיקה)`,
        lat: base + h.lat + (provider === 'booking' ? 0.0002 : 0),
        lng: baseLng + h.lng,
        stars: h.stars,
      },
      roomName: provider === 'booking' ? 'Double Room' : 'Deluxe Double',
      rooms: req.rooms.length,
      board: i % 2 ? 'room-only' : 'breakfast',
      cancellation: provider === 'booking' || i === 2 ? { kind: 'free', until: req.checkin } : { kind: 'non-refundable' },
      price:
        provider === 'agoda' && i === 3
          ? { total: { amount: total, currency: 'ILS' }, inclusive: false, excluded: { amount: 60 * nights, currency: 'ILS' } }
          : { total: { amount: total, currency: 'ILS' }, inclusive: true },
      url: `https://example.com/${provider}/${i}`,
      checkedAt: new Date().toISOString(),
    };
  });
}

export const fakeProviders: Provider[] = (['agoda', 'booking'] as const).map((id) => ({
  id,
  name: id === 'agoda' ? 'Agoda' : 'Booking.com',
  configured: () => true,
  search: async (req) => ({ offers: offers(id, req) }),
}));
