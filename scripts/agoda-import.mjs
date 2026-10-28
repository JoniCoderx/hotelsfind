#!/usr/bin/env node
// Import Agoda's affiliate "Hotel Data File" (Partner portal → Tools → Hotel Data file, CSV).
//
//   npm run agoda:import -- path/to/hotels.csv [--per-city 300]
//
// Writes:
//   src/data/agoda-cities.json      { "<slug>": <Agoda city_id> } for live city search
//   src/data/catalog/<slug>.json    the destination's hotels, most-reviewed first,
//                                   which become static /hotel/<slug>/<id>/ pages
//
// The CSV is large, so it is streamed. Column names are matched case-insensitively,
// so small header changes on Agoda's side don't break the import.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const perCity = Number(args[args.indexOf('--per-city') + 1]) || 300;
if (!file) {
  console.error('usage: npm run agoda:import -- <hotel-data-file.csv> [--per-city 300]');
  process.exit(1);
}

// Destinations we care about: slug → English city name (first part of the search term).
const destSrc = await import(join(root, 'src/data/destinations.ts')).catch(() => null);
const cities = destSrc
  ? destSrc.destinations.map((d) => ({ slug: d.slug, city: d.en.split(',')[0].trim().toLowerCase() }))
  : JSON.parse(process.env.DEST_CITIES || '[]');
if (!cities.length) {
  console.error('could not load src/data/destinations.ts; run with Node 22.6+ (type stripping) or set DEST_CITIES');
  process.exit(1);
}
// A few destinations are named after a region; accept Agoda's city names for them too.
const ALIASES = {
  'dead sea': ['dead sea', 'ein bokek', 'neve zohar', 'ein gedi'],
  tiberias: ['tiberias'],
  cyprus: ['larnaca', 'ayia napa', 'limassol', 'paphos', 'protaras'],
  crete: ['chania', 'heraklion', 'hersonissos', 'rethymno', 'agios nikolaos', 'crete island'],
  rhodes: ['rhodes', 'rhodes island', 'faliraki', 'lindos'],
  'abu dhabi': ['abu dhabi'],
  'new york': ['new york', 'new york city', 'new york (ny)', 'manhattan'],
};
const matchers = cities.map((c) => ({ ...c, names: new Set(ALIASES[c.city] ?? [c.city]) }));

// Streaming RFC 4180 CSV parser (quoted fields may contain commas and newlines).
async function* rows(path) {
  let field = '';
  let row = [];
  let quoted = false;
  let prev = '';
  for await (const chunk of createReadStream(path, { encoding: 'utf8' })) {
    for (const ch of chunk) {
      if (quoted) {
        if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') {
        if (prev === '"') field += '"';
        quoted = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field.replace(/\r$/, ''));
        yield row;
        row = [];
        field = '';
      } else field += ch;
      prev = ch;
    }
  }
  if (field || row.length) yield [...row, field];
}

let header;
const col = {};
const idCounts = new Map(); // slug → Map(city_id → count)
const catalog = new Map(); // slug → hotels[]
let total = 0;

for await (const r of rows(file)) {
  if (!header) {
    header = r.map((h) => h.trim().toLowerCase());
    for (const k of ['hotel_id', 'hotel_name', 'hotel_translated_name', 'city', 'city_id', 'country', 'star_rating',
      'rating_average', 'number_of_reviews', 'photo1', 'latitude', 'longitude', 'addressline1', 'rates_from',
      'rates_currency', 'overview', 'url', 'accommodation_type']) col[k] = header.indexOf(k);
    for (const need of ['hotel_id', 'hotel_name', 'city', 'city_id']) {
      if (col[need] < 0) {
        console.error(`column "${need}" not found. Header: ${header.join(', ')}`);
        process.exit(1);
      }
    }
    continue;
  }
  total++;
  const get = (k) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
  const city = get('city').toLowerCase();
  const m = matchers.find((x) => x.names.has(city));
  if (!m) continue;

  const cid = Number(get('city_id'));
  if (cid) {
    const counts = idCounts.get(m.slug) ?? new Map();
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
    idCounts.set(m.slug, counts);
  }
  const list = catalog.get(m.slug) ?? [];
  list.push({
    id: Number(get('hotel_id')),
    name: get('hotel_translated_name') || get('hotel_name'),
    nameEn: get('hotel_name'),
    city: get('city'),
    stars: Number(get('star_rating')) || 0,
    score: Number(get('rating_average')) || 0,
    reviews: Number(get('number_of_reviews')) || 0,
    photo: get('photo1').replace(/^http:/, 'https:'),
    address: get('addressline1'),
    lat: Number(get('latitude')) || null,
    lng: Number(get('longitude')) || null,
    ratesFrom: Number(get('rates_from')) || null,
    ratesCurrency: get('rates_currency') || null,
    type: get('accommodation_type'),
    overview: get('overview').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700),
  });
  catalog.set(m.slug, list);
}

const cityIds = {};
for (const [slug, counts] of idCounts) {
  // The main city of a destination is the ID most of its hotels share.
  cityIds[slug] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
writeFileSync(join(root, 'src/data/agoda-cities.json'), JSON.stringify(cityIds, null, 2) + '\n');

const outDir = join(root, 'src/data/catalog');
mkdirSync(outDir, { recursive: true });
// What a "popular hotel" list should hold: hotels (not hostels, campsites or private flats) with a photo
// and a good score, and for a city, near its centre, so an airport or theme-park hotel doesn't lead the list.
const HOTEL_TYPE = /hotel|resort|inn\b|serviced apartment|guesthouse|bed (and|&) breakfast/i;
const NOT_HOTEL = /hostel|camping|caravan|tent/i;
const RADIUS_KM = 6;
const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const km = (a, b) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
};
for (const [slug, list] of catalog) {
  const all = list.filter((h) => h.id && h.name);
  const m = matchers.find((x) => x.slug === slug);
  // Region destinations (several Agoda cities, e.g. Cyprus, Crete) have no single centre.
  const isCity = m.names.size === 1;
  const geo = all.filter((h) => h.lat && h.lng);
  const centre = isCity && geo.length ? { lat: median(geo.map((h) => h.lat)), lng: median(geo.map((h) => h.lng)) } : null;
  const good = (h) =>
    h.photo &&
    h.score >= 7 &&
    HOTEL_TYPE.test(h.type) &&
    !NOT_HOTEL.test(`${h.type} ${h.nameEn}`) &&
    (!centre || !h.lat || km(centre, h) <= RADIUS_KM);
  const byReviews = (a, b) => b.reviews - a.reviews || b.score - a.score;
  // The best ones first; if a small destination has too few, fill up with the rest that at least have a photo.
  const top = [...all.filter(good).sort(byReviews), ...all.filter((h) => !good(h) && h.photo).sort(byReviews)]
    .slice(0, perCity)
    .map(({ type, ...h }) => h);
  writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(top) + '\n');
  console.log(`${slug.padEnd(12)} good=${all.filter(good).length}`);
}

console.log(`read ${total} hotels`);
for (const c of cities) {
  console.log(`${c.slug.padEnd(12)} city_id=${cityIds[c.slug] ?? '—'}  hotels=${Math.min(catalog.get(c.slug)?.length ?? 0, perCity)}`);
}
