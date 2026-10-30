// The short "taking you to Booking.com" screen between a click on a booking-site link and the site itself.
// A click sends the visitor to /go/ with the link and what we know about it (site, hotel, price); that page shows
// it for under a second, then replaces itself with the booking site, so Back returns to the page clicked from.
import { href } from './url';

export const SITE_NAMES: Record<string, string> = {
  booking: 'Booking.com',
  agoda: 'Agoda',
  trip: 'Trip.com',
  expedia: 'Expedia',
  hotelscom: 'Hotels.com',
};

/** Where a link may lead from /go/: the booking sites and the affiliate networks in front of them, nothing else. */
const HOSTS = ['stay22.com', 'booking.com', 'agoda.com', 'trip.com', 'expedia.com', 'hotels.com', 'tp.media'];

export function allowedTarget(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)) ? u : null;
  } catch {
    return null;
  }
}

// What our own Allez links carry (src/lib/stay22.ts, partners.ts, hotelpage.ts). Stay22's link script decorates links
// on the page with a second campaign and its own tracking fields; the link that goes out is the one we built.
const ALLEZ_KEYS = new Set(['aid', 'link', 'lat', 'lng', 'address', 'checkin', 'checkout', 'adults', 'children', 'childrenAges', 'rooms', 'currency', 'campaign']);

/** An Allez link as we built it: one value per field, our campaign rather than the script's, nothing added on the page. */
export function cleanAllez(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!u.hostname.endsWith('stay22.com') || !u.pathname.startsWith('/allez/')) return url;
  const keep = new URLSearchParams();
  // The script's campaign is the page's host and an ID ("malonzol.com-165899"); ours never has a host in it.
  const fromScript = (v: string) => /^(localhost|[\w-]+\.[a-z]{2,})(:\d+)?-/i.test(v);
  for (const k of ALLEZ_KEYS) {
    const all = u.searchParams.getAll(k);
    const pick = k === 'campaign' ? (all.filter((v) => !fromScript(v)).at(-1) ?? all.at(-1)) : all.at(-1);
    if (pick !== undefined) keep.set(k, pick);
  }
  u.search = keep.toString();
  return u.toString();
}

/** The booking site a link ends up on, from its Stay22 or Travelpayouts wrapper or its own host. */
export function siteOf(url: string): string {
  try {
    let u = new URL(url);
    if (u.hostname.endsWith('stay22.com') && u.pathname.startsWith('/allez/')) {
      const inner = u.searchParams.get('link');
      if (!inner) return u.pathname.split('/')[2] ?? '';
      u = new URL(inner);
    } else if (u.hostname === 'tp.media' && u.searchParams.get('u')) {
      u = new URL(u.searchParams.get('u')!);
    }
    const h = u.hostname;
    if (h.endsWith('hotels.com')) return 'hotelscom';
    return ['booking', 'agoda', 'trip', 'expedia'].find((s) => h.includes(`${s}.`)) ?? '';
  } catch {
    return '';
  }
}

/** The stay a link is for, read from its own parameters (each site names them a little differently). */
export function stayOf(url: string): { checkin?: string; checkout?: string; adults?: number } {
  const all = new URLSearchParams();
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams) all.append(k.toLowerCase(), v);
    const inner = u.searchParams.get('link') || u.searchParams.get('u');
    if (inner) for (const [k, v] of new URL(inner).searchParams) all.append(k.toLowerCase(), v);
  } catch {}
  const day = (keys: string[]) => {
    for (const k of keys) {
      const v = (all.get(k) || '').replace(/\//g, '-');
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    }
    return undefined;
  };
  const adults = Number(all.get('adults') || all.get('group_adults') || all.get('adult') || '') || undefined;
  return { checkin: day(['checkin', 'chk_in', 'check_in', 'checkindate']), checkout: day(['checkout', 'chk_out', 'check_out', 'checkoutdate']), adults };
}

// The card a link sits in, and where that card keeps the hotel's name and the price shown for it.
const CARDS = '.hr, .hdc, .rank > li, .demo-card, #rate';
const PRICES = '.hr-price, .hdc-price, li.win .price, #rate-out div b';

/** The /go/ address for a click on this link. */
export function handoffUrl(a: HTMLAnchorElement): string {
  const card = a.closest<HTMLElement>(CARDS);
  const hotel = (card?.dataset.name || card?.querySelector('h1, h2, h3')?.textContent || '').trim();
  // The price on the link itself (a site's chip), else the card's headline price, which is the one this button is for.
  const priceEl = a.querySelector('b') ?? (a.closest('.hr-back') ? null : card?.querySelector(PRICES));
  const price = (priceEl?.childNodes[0]?.textContent || '').trim();
  const qs = new URLSearchParams({ u: cleanAllez(a.href), s: a.dataset.site || siteOf(a.href) });
  if (hotel) qs.set('h', hotel.slice(0, 120));
  if (/\d/.test(price)) qs.set('p', price.slice(0, 24));
  return `${href('/go/')}?${qs}`;
}
