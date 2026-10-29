// Links that open one hotel's own page on a booking site, rather than a search.
//
// Agoda: the hotel's Agoda ID, from Agoda's own hotel data file (our catalog), matched by place and name.
// Everywhere else: Stay22's Allez link with the hotel's name, which Stay22 resolves to the hotel's page. Where it
// lands depends on the whole link (the same hotel can land on its page with dates and on a city search without),
// so we follow the exact link the visitor will click and count it as direct only when it lands on one hotel:
// on Booking.com a page whose name matches ours; on the other sites a hotel ID that none of our other hotels got.
// Anything else is a search for the hotel's name, and the page says so.
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

type Site = 'booking' | 'agoda' | 'trip' | 'expedia' | 'hotelscom';

/** Where a followed Allez link landed: the site's own hotel ID, or null for a search or an error page. */
const TARGET: Record<Site, RegExp> = {
  // Booking's single-hotel search (dest_type=hotel); its hotel pages are checked by name below.
  booking: /[?&]dest_id=(\d+)&dest_type=hotel/,
  agoda: /[?&]hid=(\d+)/,
  trip: /[?&]optionId=(\d+)&optionType=Hotel|\/hotels\/detail\/?\?hotelId=(\d+)/,
  expedia: /selected(?:%3D|=)(\d+)|\.h(\d+)\.Hotel-Information/,
  hotelscom: /selected(?:%3D|=)(\d+)|\/ho(\d+)/,
};
const BOOKING_PAGE = /booking\.com\/hotel\/[a-z]{2}\/([^.?/]+)\.html/;

// Followed links, kept for half an hour (as long as a price is cached): url → where it landed.
const landed = new Map<string, { to: string; at: number }>();
const claimedBy = new Map<string, string>(); // `${site}:${site hotel ID}` → our hotel key
const disputed = new Set<string>(); // site hotel IDs that two of our hotels landed on

async function follow(url: string): Promise<string | null> {
  const hit = landed.get(url);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.to;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    const to = res.headers.get('location') || '';
    landed.set(url, { to, at: Date.now() });
    return to;
  } catch {
    return null;
  }
}

/** Whether a followed link is this hotel's own page on the site. */
export function landsOnHotel(site: Site, to: string, c: { key: string; name: string; city: string }): boolean {
  const slug = site === 'booking' && to.match(BOOKING_PAGE)?.[1];
  if (slug) return nameMatch(c.name, slug.replace(/-/g, ' '), c.city) >= 0.5;
  const m = to.match(TARGET[site]);
  const id = m && (m[1] || m[2]);
  if (!id) return false;
  const claim = `${site}:${id}`;
  const owner = claimedBy.get(claim);
  if (owner && owner !== c.key) disputed.add(claim);
  else claimedBy.set(claim, c.key);
  return !disputed.has(claim);
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
export function searchLink(site: Site, c: LinkContext) {
  return partners.find((p) => p.id === site)!.build({ ...c.stay, q: `${c.name}, ${c.city}`, source: 'compare' });
}

/** The Allez links we try for a hotel on a site, most precise first, each with the visitor's stay. */
function allezCandidates(site: Site, c: LinkContext) {
  const s = c.stay;
  const stay = {
    checkin: s.checkin,
    checkout: s.checkout,
    adults: s.adults,
    children: s.children || undefined,
    childrenAges: s.children && s.childAges?.length === s.children ? s.childAges.join(',') : undefined,
    currency: 'ILS',
    campaign: `compare_${c.slug}`,
  };
  const out: string[] = [];
  if (c.lat != null && c.lng != null) out.push(allezUrl(site, { hotelname: c.name, lat: c.lat, lng: c.lng, ...stay }));
  out.push(allezUrl(site, { hotelname: c.name, address: c.city, ...stay }));
  if (site === 'booking') out.push(allezUrl(site, { hotelname: c.name, ...stay }));
  return out;
}

/** The best link we can give for this hotel on one site, and whether it opens the hotel's own page. */
async function siteLink(site: Site, c: LinkContext): Promise<{ url: string; direct: boolean }> {
  const s = c.stay;
  if (site === 'agoda') {
    const h = catalogMatch(c.slug, c.name, c.lat, c.lng, c.city);
    if (h) {
      return {
        url: agodaHotel(h.id, { checkin: s.checkin, checkout: s.checkout, adults: s.adults, children: s.children, childAges: s.childAges }),
        direct: true,
      };
    }
  }
  for (const url of allezCandidates(site, c)) {
    const to = await follow(url);
    if (to && landsOnHotel(site, to, c)) return { url, direct: true };
  }
  return { url: searchLink(site, c), direct: false };
}

/** Links for the sites that priced this hotel (and Booking.com, for the "no price" fallback). */
export async function hotelLinks(c: LinkContext, sites: Site[]) {
  const want = [...new Set<Site>([...sites, 'booking'])];
  const links = await Promise.all(want.map((site) => siteLink(site, c)));
  return Object.fromEntries(want.map((site, i) => [site, links[i]])) as Record<Site, { url: string; direct: boolean }>;
}
