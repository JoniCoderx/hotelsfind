// Links that open one hotel's own page on a booking site, credited to our Stay22 account.
//
// Two steps. First, which hotel it is on each site: on Agoda from Agoda's own hotel data file (our catalog), matched
// by place and name; otherwise by following Stay22's Allez name lookup, which is fuzzy and varies between calls, so
// a result counts only when it lands on one hotel (on Booking.com a page whose name matches ours; elsewhere a hotel
// ID no other hotel of ours got). Then the link: Allez with `link=` that hotel's page plus the stay, which Stay22
// sends to that same hotel every time, with our tracking. Where we can't tell the hotel, a search for its name.
import { catalog, type CatalogHotel } from './catalog';
import { partners, type SearchQuery } from './partners';
import { allezUrl } from './stay22';
import { SITES, allezStay, hotelPage, type Site } from './hotelpage';

export { hotelPage };

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



/** The site's hotel ID in a followed Allez link (Booking.com hotel pages are read by name below). */
const TARGET: Record<Site, RegExp> = {
  booking: /[?&]dest_id=(\d+)&dest_type=hotel/,
  agoda: /[?&](?:hid|selectedproperty)=(\d+)/,
  trip: /[?&]optionId=(\d+)&optionType=Hotel|\/hotels\/detail\/?\?hotelId=(\d+)/,
  expedia: /selected(?:%3D|=)(\d+)|\.h(\d+)\.Hotel-Information/,
  hotelscom: /selected(?:%3D|=)(\d+)|\/ho(\d+)/,
};
const BOOKING_PAGE = /booking\.com\/hotel\/([a-z]{2})\/([^.?/]+)\.html/;

// Which hotel each of ours is on each site, kept for a day: `${site}:${hotel key}` → site hotel ID ('' = unknown).
const identity = new Map<string, { id: string; at: number }>();
const claimedBy = new Map<string, string>(); // `${site}:${site hotel ID}` → our hotel key
const disputed = new Set<string>(); // site hotel IDs that two of our hotels landed on

async function follow(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) });
    return res.headers.get('location') || '';
  } catch {
    return null;
  }
}

/** The site's ID for this hotel when a followed link lands on it: 'cc/slug' for a Booking.com page, else a number. */
export function landedId(site: Site, to: string, c: { key: string; name: string; city: string }): string | null {
  const page = site === 'booking' ? to.match(BOOKING_PAGE) : null;
  if (page) return nameMatch(c.name, page[2].replace(/-/g, ' '), c.city) >= 0.5 ? `${page[1]}/${page[2]}` : null;
  const m = to.match(TARGET[site]);
  const id = m && (m[1] || m[2]);
  if (!id) return null;
  const claim = `${site}:${id}`;
  const owner = claimedBy.get(claim);
  if (owner && owner !== c.key) disputed.add(claim);
  else claimedBy.set(claim, c.key);
  return disputed.has(claim) ? null : id;
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

/** A stay to look hotels up with: Allez resolves a hotel more often when the link has dates. */
function lookupStay(c: LinkContext) {
  if (c.stay.checkin && c.stay.checkout) return allezStay(c.stay, 'check');
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return allezStay({ checkin: day(30), checkout: day(32), adults: 2 }, 'check');
}

/** This hotel's ID on the site: '' when we can't tell it for sure, null when a site didn't answer in time. */
async function siteHotelId(site: Site, c: LinkContext): Promise<string | null> {
  const k = `${site}:${c.key}`;
  const hit = identity.get(k);
  if (hit && Date.now() - hit.at < 24 * 3_600_000) {
    // An ID another hotel of ours has since claimed is no longer trusted.
    return hit.id && !disputed.has(`${site}:${hit.id}`) ? hit.id : '';
  }
  let id = '';
  if (site === 'agoda') id = String(catalogMatch(c.slug, c.name, c.lat, c.lng, c.city)?.id ?? '');
  if (!id) {
    const stay = lookupStay(c);
    const tries: Record<string, string | number>[] = [];
    if (c.lat != null && c.lng != null) tries.push({ hotelname: c.name, lat: c.lat, lng: c.lng });
    tries.push({ hotelname: c.name, address: c.city });
    if (site === 'booking') tries.push({ hotelname: c.name });
    let failed = false;
    for (const q of tries) {
      const to = await follow(allezUrl(site, { ...q, ...stay }));
      if (to === null) failed = true;
      const got = to && landedId(site, to, c);
      if (got) {
        id = got;
        break;
      }
    }
    if (!id && failed) return null; // a timeout says nothing about the hotel: don't remember it
  }
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
