// A hotel's own page on a booking site, and the Stay22 link that opens it with the visitor's stay.
// Small and dependency-light so the browser can build the links once it knows the hotel's ID on each site.
import { allezUrl } from './stay22';
import { currency } from './currency';

export type Site = 'booking' | 'agoda' | 'trip' | 'expedia' | 'hotelscom';
export const SITES: Site[] = ['booking', 'agoda', 'trip', 'expedia', 'hotelscom'];

/** The hotel's own page on the site, without dates or tracking (Allez adds both). */
export function hotelPage(site: Site, id: string): string {
  if (site === 'booking') return id.includes('/') ? `https://www.booking.com/hotel/${id}.html` : `https://www.booking.com/searchresults.html?dest_id=${id}&dest_type=hotel`;
  if (site === 'agoda') return `https://www.agoda.com/partners/partnersearch.aspx?hid=${id}`;
  if (site === 'trip') return `https://www.trip.com/hotels/detail/?hotelId=${id}`;
  if (site === 'expedia') return `https://www.expedia.com/h${id}.Hotel-Information`;
  return `https://www.hotels.com/ho${id}`;
}

export interface Stay {
  checkin?: string;
  checkout?: string;
  adults: number;
  children?: number;
  childAges?: number[];
}

/** The stay as Allez takes it. */
export function allezStay(s: Stay, campaign: string) {
  return {
    checkin: s.checkin,
    checkout: s.checkout,
    adults: s.adults,
    children: s.children || undefined,
    childrenAges: s.children && s.childAges?.length === s.children ? s.childAges.join(',') : undefined,
    currency: currency(),
    campaign,
  };
}

/** Stay22's link to the hotel's own page on the site, credited to our account. */
export function directLink(site: Site, id: string, s: Stay, campaign: string): string {
  return allezUrl(site, { link: hotelPage(site, id), ...allezStay(s, campaign) });
}
