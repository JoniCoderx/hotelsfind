// Stay22 hotel map (https://dev.stay22.com/docs/maps): an iframe of hotels around a place, with
// bookings credited to our Stay22 affiliate ID.

export const STAY22_AID = import.meta.env.PUBLIC_STAY22_AID || 'malonzol';

export interface MapPlace {
  lat?: number;
  lng?: number;
  /** Used when there are no coordinates. */
  address?: string;
  /** Search radius in km; wider places open further out. */
  radiusKm?: number;
}

/** Map zoom for a search radius: a city opens on its centre, an island or region on the whole area. */
export function zoomFor(radiusKm = 8): number {
  if (radiusKm <= 10) return 13;
  if (radiusKm <= 20) return 12;
  if (radiusKm <= 30) return 11;
  return 9;
}

export function stay22Url(p: MapPlace, campaign: string, dates?: { checkin: string; checkout: string }): string {
  const q = new URLSearchParams({ aid: STAY22_AID });
  if (p.lat != null && p.lng != null) {
    q.set('lat', String(p.lat));
    q.set('lng', String(p.lng));
  } else if (p.address) {
    q.set('address', p.address);
  }
  q.set('zoom', String(zoomFor(p.radiusKm)));
  q.set('campaign', campaign);
  q.set('maincolor', '0b2c95');
  q.set('hidemainmarker', 'true');
  if (dates) {
    q.set('checkin', dates.checkin);
    q.set('checkout', dates.checkout);
  }
  return `https://www.stay22.com/embed/gm?${q}`;
}
