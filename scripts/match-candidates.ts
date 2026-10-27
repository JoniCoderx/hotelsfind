// Propose hotel matches between two connectors' content lists for a person to verify.
// It never writes data/hotel-map.json: a row goes there only after someone checks both listings.
//
//   node --experimental-strip-types scripts/match-candidates.ts agoda.json booking.json > candidates.csv
//
// Each input is a JSON array of { id, name, lat, lng } (e.g. Agoda's content feed, Booking's
// /accommodations/details for the destination).

import { readFileSync } from 'node:fs';
import { STRONG_MATCH, distanceM, nameSimilarity } from '../src/lib/meta/match.ts';

type Row = { id: string | number; name: string; lat: number; lng: number };
const [aFile, bFile] = process.argv.slice(2);
if (!aFile || !bFile) {
  console.error('usage: match-candidates.ts <a.json> <b.json>');
  process.exit(1);
}
const a: Row[] = JSON.parse(readFileSync(aFile, 'utf8'));
const b: Row[] = JSON.parse(readFileSync(bFile, 'utf8'));
const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

console.log('a_id,a_name,b_id,b_name,metres,name_score,how_sure');
for (const x of a) {
  const near = b
    .map((y) => ({ y, m: distanceM(x, y), s: nameSimilarity(x.name, y.name) }))
    .filter((c) => c.m <= 300)
    .sort((p, r) => r.s - p.s || p.m - r.m)
    .slice(0, 3);
  for (const { y, m, s } of near) {
    // Only a hint for the reviewer; resorts and apartment blocks share names and addresses.
    const how = m <= STRONG_MATCH.maxMetres && s >= STRONG_MATCH.minName ? 'likely' : s >= 0.6 ? 'check' : 'unlikely';
    console.log([x.id, q(x.name), y.id, q(y.name), Math.round(m), s.toFixed(2), how].join(','));
  }
}
