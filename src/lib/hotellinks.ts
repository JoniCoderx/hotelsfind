// Links that open one hotel's own page on a booking site, credited to our Stay22 account.
//
// Which hotel it is on each site, checked before any link uses it:
// - Agoda: the hotel's ID from Agoda's own hotel data file (our catalog), matched by place and name; otherwise an ID
//   from Stay22's name lookup, kept only when that ID is in the catalog under a matching name (a city check alone
//   let neighbours through: Neve Eilat came back as Nova Like, two Atlas hotels a street apart).
// - Booking.com: a hotel page in the destination's country whose name matches ours (a single-hotel search from the
//   lookup is followed again until it shows its page, or dropped).
// - Trip.com, Expedia and Hotels.com: nothing we can read tells us the hotel's name (Trip.com's city check passed
//   Dan Eilat for Dan Panorama), so they always get a search for the hotel.
// Stay22's name lookup is fuzzy and varies between calls (it once sent a hotel in Eilat to Mexico), so anything
// unchecked is dropped. The link is Allez with `link=` that hotel's page plus the stay; where we can't tell the hotel,
// a search around its coordinates, which always lands in the right place.
import { catalog, type CatalogHotel } from './catalog';
import { partners, type SearchQuery } from './partners';
import { allezUrl } from './stay22';
import { SITES, allezStay, hotelPage, type Site } from './hotelpage';

export { hotelPage };

export { nameTokens, nameMatch, SAME_NAME } from './names';
import { nameMatch, SAME_NAME } from './names';

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
    // Nearby and the same name; far apart (or without coordinates) only with exactly the same distinctive words.
    if ((near && score >= SAME_NAME) || score === 1) if (!best || score > best.score) best = { h, score };
  }
  return best?.h;
}



/** ISO country of each destination, for checking where a Booking.com hotel page is. */
export const COUNTRY: Record<string, string> = {
  eilat: 'il',
  'dead-sea': 'il',
  'tel-aviv': 'il',
  jerusalem: 'il',
  tiberias: 'il',
  haifa: 'il',
  netanya: 'il',
  athens: 'gr',
  rhodes: 'gr',
  crete: 'gr',
  cyprus: 'cy',
  dubai: 'ae',
  'abu-dhabi': 'ae',
  paris: 'fr',
  london: 'gb',
  rome: 'it',
  barcelona: 'es',
  prague: 'cz',
  budapest: 'hu',
  amsterdam: 'nl',
  'new-york': 'us',
  batumi: 'ge',
  bangkok: 'th',
};

const BOOKING_PAGE = /booking\.com\/hotel\/([a-z]{2})\/([^.?/]+)\.html/;
const BOOKING_HOTEL = /[?&]dest_id=(\d+)&dest_type=hotel/;
const AGODA_HOTEL = /[?&](?:hid|selectedproperty)=(\d+)/;
const AGODA_CITY = /[?&]city=(\d+)/;
const TRIP_HOTEL = /[?&]optionId=(\d+)&optionType=Hotel|\/hotels\/detail\/?\?hotelId=(\d+)/;
const TRIP_CITY = /[?&]city=(\d+)/;

/** A Booking.com hotel page ('cc/slug') if the address is one in the right country with a matching name. */
export function bookingPage(to: string, c: { name: string; city: string; slug: string }): string | null {
  const m = to.match(BOOKING_PAGE);
  if (!m || m[1] !== COUNTRY[c.slug]) return null;
  return nameMatch(c.name, m[2].replace(/-/g, ' '), c.city) >= SAME_NAME ? `${m[1]}/${m[2]}` : null;
}

const pick = (to: string, re: RegExp) => {
  const m = to.match(re);
  return m ? m[1] || m[2] || null : null;
};

// Followed links, kept for a day (Stay22's answers for the same link vary, so a check is a few follows at most).
const followed = new Map<string, { to: string; at: number }>();
async function follow(url: string, fresh = false): Promise<string | null> {
  const hit = followed.get(url);
  if (!fresh && hit && Date.now() - hit.at < 24 * 3_600_000) return hit.to;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const to = res.headers.get('location') || '';
    followed.set(url, { to, at: Date.now() });
    return to;
  } catch {
    return null;
  }
}

// One of our hotels per site ID: when two land on the same ID, neither keeps it.
const claimedBy = new Map<string, string>();
const disputed = new Set<string>();
function claim(site: Site, id: string, key: string): boolean {
  const k = `${site}:${id}`;
  const owner = claimedBy.get(k);
  if (owner && owner !== key) disputed.add(k);
  else claimedBy.set(k, key);
  return !disputed.has(k);
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

/** A search on the site, around the hotel when we have its coordinates. */
export function searchLink(site: Site, c: LinkContext) {
  return partners.find((p) => p.id === site)!.build({ ...c.stay, q: `${c.name}, ${c.city}`, source: 'compare', lat: c.lat, lng: c.lng });
}

/** A stay to look hotels up with: Allez resolves a hotel more often when the link has dates. */
function lookupStay(c: LinkContext) {
  if (c.stay.checkin && c.stay.checkout) return allezStay(c.stay, 'check');
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return allezStay({ checkin: day(30), checkout: day(32), adults: 2 }, 'check');
}

/** The Allez name lookups for a hotel, most precise first. */
function lookups(site: Site, c: LinkContext) {
  const stay = lookupStay(c);
  const out: string[] = [];
  if (c.lat != null && c.lng != null) out.push(allezUrl(site, { hotelname: c.name, lat: c.lat, lng: c.lng, ...stay }));
  out.push(allezUrl(site, { hotelname: c.name, address: c.city, ...stay }));
  return out;
}

/** The city a site gives for the hotel's own coordinates (Agoda and Trip.com), to check an ID's city against. */
async function cityAt(site: 'agoda' | 'trip', c: LinkContext): Promise<string | null> {
  if (c.lat == null || c.lng == null) return null;
  const to = await follow(allezUrl(site, { lat: c.lat, lng: c.lng, ...lookupStay(c) }));
  return to ? pick(to, site === 'agoda' ? AGODA_CITY : TRIP_CITY) : null;
}

/** The city of a hotel ID on Agoda or Trip.com, by opening it through Allez. */
async function cityOf(site: 'agoda' | 'trip', id: string): Promise<string | null> {
  const page = site === 'agoda' ? `https://www.agoda.com/partners/partnersearch.aspx?hid=${id}` : `https://www.trip.com/hotels/detail/?hotelId=${id}`;
  const to = await follow(allezUrl(site, { link: page, campaign: 'check' }));
  return to ? pick(to, site === 'agoda' ? AGODA_CITY : TRIP_CITY) : null;
}

async function bookingId(c: LinkContext): Promise<string | null> {
  let timedOut = false;
  for (const url of lookups('booking', c)) {
    const to = await follow(url);
    if (to === null) {
      timedOut = true;
      continue;
    }
    const page = bookingPage(to, c);
    if (page) return claim('booking', page, c.key) ? page : '';
    // A single-hotel search doesn't say which hotel: open it again until Booking shows its page, else drop it.
    const destId = pick(to, BOOKING_HOTEL);
    if (destId) {
      const again = allezUrl('booking', { link: `https://www.booking.com/searchresults.html?dest_id=${destId}&dest_type=hotel`, ...lookupStay(c) });
      for (let i = 0; i < 3; i++) {
        const t = await follow(again, i > 0);
        const p = t && bookingPage(t, c);
        if (p) return claim('booking', p, c.key) ? p : '';
      }
    }
  }
  return timedOut ? null : '';
}

async function cityCheckedId(site: 'agoda' | 'trip', c: LinkContext): Promise<string | null> {
  const want = await cityAt(site, c);
  if (want === null) return '';
  let timedOut = false;
  for (const url of lookups(site, c)) {
    const to = await follow(url);
    if (to === null) {
      timedOut = true;
      continue;
    }
    const id = pick(to, site === 'agoda' ? AGODA_HOTEL : TRIP_HOTEL);
    if (!id) continue;
    // The ID's city must be the city the site gives for the hotel's own coordinates.
    const city = pick(to, site === 'agoda' ? AGODA_CITY : TRIP_CITY) ?? (await cityOf(site, id));
    if (city === want) return claim(site, id, c.key) ? id : '';
  }
  return timedOut ? null : '';
}

// Which hotel each of ours is on each site, kept for a day: `${site}:${hotel key}` → site ID ('' = can't tell).
const identity = new Map<string, { id: string; at: number }>();

/** This hotel's checked ID on the site: '' when we can't tell it for sure, null when a site didn't answer in time. */
async function siteHotelId(site: Site, c: LinkContext): Promise<string | null> {
  if (site === 'expedia' || site === 'hotelscom' || site === 'trip') return '';
  const k = `${site}:${c.key}`;
  const hit = identity.get(k);
  if (hit && Date.now() - hit.at < 24 * 3_600_000) return hit.id && !disputed.has(`${site}:${hit.id}`) ? hit.id : '';
  let id: string | null = '';
  if (site === 'agoda') {
    const h = catalogMatch(c.slug, c.name, c.lat, c.lng, c.city);
    id = h ? String(h.id) : await cityCheckedId('agoda', c);
    // A looked-up ID must be one of Agoda's hotels we know by name, and the same name as ours.
    if (id && !h) {
      const known = (catalog[c.slug] ?? []).find((x) => String(x.id) === id);
      if (!known || nameMatch(c.name, known.nameEn || known.name, c.city) < SAME_NAME) id = '';
    }
  } else {
    id = await bookingId(c);
  }
  if (id === null) return null; // a timeout says nothing about the hotel: don't remember it
  identity.set(k, { id, at: Date.now() });
  return id;
}

/**
 * The hotel's ID on every site ('' where we can't tell it), and whether every site answered. The IDs don't depend
 * on the stay, so they can be cached for long; the browser builds the links with the visitor's dates.
 */
export async function hotelIds(c: LinkContext): Promise<{ ids: Record<Site, string>; complete: boolean }> {
  const got = await Promise.all(SITES.map((site) => siteHotelId(site, c)));
  return {
    ids: Object.fromEntries(SITES.map((site, i) => [site, got[i] ?? ''])) as Record<Site, string>,
    complete: got.every((x) => x !== null),
  };
}
