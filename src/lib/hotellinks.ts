// Links that open one hotel's own page on a booking site, rather than a search.
//
// Agoda: the hotel's Agoda ID, from Agoda's own hotel data file (our catalog), matched by place and name.
// Booking.com: Stay22's Allez link with the hotel's name and coordinates, which resolves the hotel on Booking.
// Allez matches names fuzzily, so we follow its redirect once and keep the link only when it lands on a
// hotel page whose name matches ours; otherwise the visitor gets a search for the hotel's name.
import { catalog, type CatalogHotel } from './catalog';
import { agodaHotel, partners, type SearchQuery } from './partners';
import { allezUrl } from './stay22';

const STOP = new Set(
  'hotel hotels resort resorts spa the by and an a of at in collection exclusive suites suite boutique inn apartments apartment rooms club luxury beach'.split(
    ' ',
  ),
);

/** The distinctive words of a hotel name (lowercase, accents dropped, common words and the place's own words left out). */
export function nameTokens(s: string, place = ''): Set<string> {
  const skip = place ? nameTokens(place) : new Set<string>();
  const plain = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  return new Set(plain.split(' ').filter((w) => w.length > 1 && !STOP.has(w) && !skip.has(w)));
}

// Chain names: sharing one says nothing about being the same hotel ("Kayma by Isrotel" isn't "Isrotel Dead Sea").
const CHAINS = new Set(
  'isrotel leonardo fattal dan herods astral prima atlas brown hilton marriott ibis novotel mercure crowne radisson sheraton hyatt melia ramada intercontinental kempinski rotana jumeirah wyndham ihg accor nh hampton doubletree courtyard sofitel pullman movenpick hotel'.split(
    ' ',
  ),
);

/**
 * Share of the shorter name's distinctive words that the other name also has (0–1). `place` words don't count,
 * and a match on chain names alone scores 0.
 */
export function nameMatch(a: string, b: string, place = ''): number {
  const x = nameTokens(a, place);
  const y = nameTokens(b, place);
  if (!x.size || !y.size) return 0;
  let common = 0;
  let own = 0;
  for (const w of x) {
    if (!y.has(w)) continue;
    common++;
    if (!CHAINS.has(w)) own++;
  }
  return own ? common / Math.min(x.size, y.size) : 0;
}

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const x = (bLng - aLng) * r * Math.cos(((aLat + bLat) / 2) * r);
  const y = (bLat - aLat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** The same hotel in our Agoda catalog: within 400 m and with a matching name. */
export function catalogMatch(slug: string, name: string, lat?: number, lng?: number, place = ''): CatalogHotel | undefined {
  let best: { h: CatalogHotel; score: number } | undefined;
  for (const h of catalog[slug] ?? []) {
    const near = lat != null && lng != null && h.lat != null && h.lng != null ? km(lat, lng, h.lat, h.lng) <= 0.4 : false;
    const score = nameMatch(name, h.nameEn || h.name, place);
    if ((near && score >= 0.5) || score === 1) if (!best || score > best.score) best = { h, score };
  }
  return best?.h;
}

/**
 * Which Allez query lands on this hotel's own Booking.com page: by name and coordinates, else by name alone.
 * null when neither lands on a hotel page whose name matches ours.
 */
type BookingQuery = 'geo' | 'name' | null;
const bookingChecked = new Map<string, BookingQuery>();
export async function bookingResolves(key: string, name: string, lat?: number, lng?: number, place = ''): Promise<BookingQuery> {
  if (bookingChecked.has(key)) return bookingChecked.get(key)!;
  const tries: [Exclude<BookingQuery, null>, Record<string, string | number | undefined>][] = [
    ['geo', { hotelname: name, lat, lng }],
    ['name', { hotelname: name }],
  ];
  let found: BookingQuery = null;
  for (const [kind, params] of tries) {
    if (kind === 'geo' && (lat == null || lng == null)) continue;
    try {
      const res = await fetch(allezUrl('booking', { ...params, campaign: 'check' }), { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      const slug = (res.headers.get('location') || '').match(/booking\.com\/hotel\/[a-z]{2}\/([^.?/]+)\.html/)?.[1];
      if (slug && nameMatch(name, slug.replace(/-/g, ' '), place) >= 0.5) {
        found = kind;
        break;
      }
    } catch {
      return null; // a timeout says nothing about the hotel: don't remember it
    }
  }
  bookingChecked.set(key, found);
  return found;
}

export interface LinkContext {
  slug: string;
  key: string;
  name: string;
  lat?: number;
  lng?: number;
  city: string;
  stay: Pick<SearchQuery, 'checkin' | 'checkout' | 'adults' | 'children' | 'childAges' | 'rooms'>;
}

/** A search for the hotel by name on the site: the fallback when we can't name the exact hotel page. */
export function searchLink(site: 'booking' | 'agoda' | 'trip' | 'expedia' | 'hotelscom', c: LinkContext) {
  return partners.find((p) => p.id === site)!.build({ ...c.stay, q: `${c.name}, ${c.city}`, source: 'compare' });
}

/** The best link we can give for this hotel on each site, and whether it opens the hotel's own page. */
export async function hotelLinks(c: LinkContext) {
  const s = c.stay;
  const agoda = catalogMatch(c.slug, c.name, c.lat, c.lng, c.city);
  const booking = await bookingResolves(c.key, c.name, c.lat, c.lng, c.city);
  const links: Record<string, { url: string; direct: boolean }> = {};
  for (const site of ['booking', 'agoda', 'trip', 'expedia', 'hotelscom'] as const) links[site] = { url: searchLink(site, c), direct: false };
  if (agoda) {
    links.agoda = {
      url: agodaHotel(agoda.id, { checkin: s.checkin, checkout: s.checkout, adults: s.adults, children: s.children, childAges: s.childAges }),
      direct: true,
    };
  }
  if (booking) {
    links.booking = {
      url: allezUrl('booking', {
        hotelname: c.name,
        lat: booking === 'geo' ? c.lat : undefined,
        lng: booking === 'geo' ? c.lng : undefined,
        checkin: s.checkin,
        checkout: s.checkout,
        adults: s.adults,
        children: s.children || undefined,
        childrenAges: s.children && s.childAges?.length === s.children ? s.childAges.join(',') : undefined,
        currency: 'ILS',
        campaign: `compare_${c.slug}`,
      }),
      direct: true,
    };
  }
  return links;
}
