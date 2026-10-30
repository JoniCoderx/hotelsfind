import { describe, expect, it } from 'vitest';
import { directLink } from './hotelpage';

describe('hotel links', () => {
  // QA: a two-room search produced a Booking link without a room count.
  it('carry rooms, children and their ages, and one campaign', () => {
    const u = new URL(directLink('booking', 'il/jacob-eilat', { checkin: '2026-11-12', checkout: '2026-11-14', adults: 2, children: 1, childAges: [6], rooms: 2 }, 'test'));
    expect(u.searchParams.get('rooms')).toBe('2');
    expect(u.searchParams.get('childrenAges')).toBe('6');
    expect(u.searchParams.getAll('campaign')).toEqual(['test']);
  });
  it('leave rooms out for one room', () => {
    const u = new URL(directLink('agoda', '165899', { adults: 2, rooms: 1 }, 'test'));
    expect(u.searchParams.has('rooms')).toBe(false);
  });
});
