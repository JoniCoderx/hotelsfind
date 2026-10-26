// Ask every configured connector about the same verified hotel list, then group offers by our hotel ID
// and rank them. Only verified mappings join offers; strong name+location look-alikes are returned as
// candidates for a person to check, never merged.

import { STRONG_MATCH, distanceM, nameSimilarity } from './match';
import { rankOffers, type Fx, type RankOptions, type RankedOffer } from './rank';
import type { Connector, ConnectorStatus, MappedHotel, Offer, SearchRequest } from './types';

export interface HotelResult {
  id: string;
  name: string;
  stars?: number;
  offers: RankedOffer[];
  sitesCompared: number;
  sites: string[];
}

export interface Candidate {
  a: { source: string; id: string; name: string };
  b: { source: string; id: string; name: string };
  metres: number;
  nameScore: number;
}

export interface CompareResult {
  hotels: HotelResult[];
  connectors: ConnectorStatus[];
  /** Offers that didn't map to a verified hotel, paired when they look alike, for manual review. */
  candidates: Candidate[];
  checkedAt: string;
}

export async function runConnectors(
  req: SearchRequest,
  hotels: MappedHotel[],
  connectors: Connector[],
  timeoutMs: number,
): Promise<{ offers: Offer[]; statuses: ConnectorStatus[] }> {
  const statuses: ConnectorStatus[] = [];
  const offers: Offer[] = [];
  await Promise.all(
    connectors.map(async (c) => {
      const t0 = Date.now();
      if (!c.configured()) {
        statuses.push({ source: c.id, status: 'not-configured', reason: 'אין מפתח API', ms: 0 });
        return;
      }
      try {
        const r = await c.search(req, hotels, AbortSignal.timeout(timeoutMs));
        const ms = Date.now() - t0;
        if (r.unsupported) statuses.push({ source: c.id, status: 'unsupported', reason: r.unsupported, ms });
        else {
          offers.push(...r.offers);
          statuses.push(
            r.complete === false
              ? { source: c.id, status: 'partial', offers: r.offers.length, ms, reason: 'לא כל האתרים ענו בזמן' }
              : { source: c.id, status: 'ok', offers: r.offers.length, ms },
          );
        }
      } catch (e) {
        const timeout = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
        statuses.push({
          source: c.id,
          status: timeout ? 'timeout' : 'error',
          reason: timeout ? 'לא ענה בזמן' : 'שגיאה אצל הספק',
          ms: Date.now() - t0,
        });
      }
    }),
  );
  statuses.sort((a, b) => connectors.findIndex((c) => c.id === a.source) - connectors.findIndex((c) => c.id === b.source));
  return { offers, statuses };
}

/** Our hotel ID for an offer, from the verified mapping only. */
export function mappedId(o: Offer, hotels: MappedHotel[]): string | undefined {
  const h = hotels.find((m) =>
    o.source === 'agoda-search'
      ? String(m.agoda) === o.hotel.id
      : o.source === 'booking-demand'
        ? String(m.booking) === o.hotel.id
        : o.source === 'vio'
          ? // A name query must come back as the exact property we verified, not a neighbour with a similar name.
            Boolean(m.vioName && m.vioUrl) && m.vioName === o.hotel.id && m.vioUrl === o.hotel.ref
          : m.id === o.hotel.id,
  );
  return h?.id;
}

function lookAlikes(unmapped: Offer[]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const a of unmapped)
    for (const b of unmapped) {
      if (a.source >= b.source || a.hotel.lat == null || b.hotel.lat == null) continue;
      const key = `${a.source}:${a.hotel.id}|${b.source}:${b.hotel.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const metres = Math.round(distanceM(a.hotel as { lat: number; lng: number }, b.hotel as { lat: number; lng: number }));
      const nameScore = nameSimilarity(a.hotel.name, b.hotel.name);
      if (metres <= STRONG_MATCH.maxMetres && nameScore >= STRONG_MATCH.minName)
        out.push({
          a: { source: a.source, id: a.hotel.id, name: a.hotel.name },
          b: { source: b.source, id: b.hotel.id, name: b.hotel.name },
          metres,
          nameScore: Math.round(nameScore * 100) / 100,
        });
    }
  return out;
}

export async function compare(
  req: SearchRequest,
  hotels: MappedHotel[],
  connectors: Connector[],
  opts: { timeoutMs?: number; fx?: Fx } & RankOptions,
): Promise<CompareResult> {
  const { offers, statuses } = await runConnectors(req, hotels, connectors, opts.timeoutMs ?? 8000);
  const fx = opts.fx ?? (() => undefined);
  const byHotel = new Map<string, Offer[]>();
  const unmapped: Offer[] = [];
  for (const o of offers) {
    const id = mappedId(o, hotels);
    if (!id) unmapped.push(o);
    else byHotel.set(id, [...(byHotel.get(id) ?? []), o]);
  }
  const results: HotelResult[] = [...byHotel.entries()].map(([id, list]) => {
    const h = hotels.find((m) => m.id === id)!;
    const ranked = rankOffers(list, req.currency, fx, req.rooms.length, opts);
    return { id, name: h.name, stars: h.stars, ...ranked, sites: [...new Set(list.map((o) => o.site.name))] };
  });
  // Hotels with a real comparison first, then by best all-in price.
  results.sort(
    (a, b) =>
      Number(b.sitesCompared >= 2) - Number(a.sitesCompared >= 2) ||
      (a.offers[0]?.all.amount ?? Infinity) - (b.offers[0]?.all.amount ?? Infinity),
  );
  return { hotels: results, connectors: statuses, candidates: lookAlikes(unmapped), checkedAt: new Date().toISOString() };
}
