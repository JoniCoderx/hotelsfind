import { describe, expect, it } from 'vitest';
import { stay22Url, zoomFor } from './stay22';

describe('stay22Url', () => {
  it('uses coordinates, our AID and the campaign', () => {
    const u = new URL(stay22Url({ lat: 41.9028, lng: 12.4964, radiusKm: 8 }, 'guide-rome'));
    expect(u.origin + u.pathname).toBe('https://www.stay22.com/embed/gm');
    expect(u.searchParams.get('aid')).toBe('malonzol');
    expect(u.searchParams.get('lat')).toBe('41.9028');
    expect(u.searchParams.get('lng')).toBe('12.4964');
    expect(u.searchParams.get('address')).toBeNull();
    expect(u.searchParams.get('zoom')).toBe('13');
    expect(u.searchParams.get('campaign')).toBe('guide-rome');
  });

  it('falls back to the address and adds dates when given', () => {
    const u = new URL(stay22Url({ address: 'Hanoi, Vietnam' }, 'guide-vietnam', { checkin: '2026-12-01', checkout: '2026-12-05' }));
    expect(u.searchParams.get('address')).toBe('Hanoi, Vietnam');
    expect(u.searchParams.get('checkin')).toBe('2026-12-01');
    expect(u.searchParams.get('checkout')).toBe('2026-12-05');
  });

  it('opens wider for islands and regions', () => {
    expect(zoomFor(8)).toBe(13);
    expect(zoomFor(20)).toBe(12);
    expect(zoomFor(60)).toBe(9);
  });
});
