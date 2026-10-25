// Ask every configured provider in parallel, then group offers by hotel and rank them.
// A provider that fails, times out or can't serve the request is reported, never replaced with sample data.

import { sameHotel, type Mapping, type MatchKind } from './match';
import { rankOffers, type Fx, type RankedOffer } from './rank';
import type { HotelRef, Offer, Provider, ProviderStatus, SearchRequest } from './types';

export interface HotelResult {
  key: string;
  name: string;
  lat?: number;
  lng?: number;
  stars?: number;
  image?: string;
  /** How the offers were joined: a curated mapping, a strong name+location match, or one provider only. */
  match: MatchKind | 'single';
  offers: RankedOffer[];
  providers: string[];
}

export interface CompareResult {
  hotels: HotelResult[];
  providers: ProviderStatus[];
  checkedAt: string;
}

export async function runProviders(
  req: SearchRequest,
  providers: Provider[],
  timeoutMs: number,
): Promise<{ offers: Offer[]; statuses: ProviderStatus[] }> {
  const statuses: ProviderStatus[] = [];
  const offers: Offer[] = [];
  await Promise.all(
    providers.map(async (p) => {
      const t0 = Date.now();
      if (!p.configured()) {
        statuses.push({ provider: p.id, status: 'not-configured', reason: 'אין מפתח API', ms: 0 });
        return;
      }
      try {
        const r = await p.search(req, AbortSignal.timeout(timeoutMs));
        if (r.unsupported) statuses.push({ provider: p.id, status: 'unsupported', reason: r.unsupported, ms: Date.now() - t0 });
        else {
          offers.push(...r.offers);
          statuses.push({ provider: p.id, status: 'ok', offers: r.offers.length, ms: Date.now() - t0 });
        }
      } catch (e) {
        const timeout = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
        statuses.push({
          provider: p.id,
          status: timeout ? 'timeout' : 'error',
          reason: timeout ? 'לא ענה בזמן' : 'שגיאה אצל הספק',
          ms: Date.now() - t0,
        });
      }
    }),
  );
  statuses.sort((a, b) => providers.findIndex((p) => p.id === a.provider) - providers.findIndex((p) => p.id === b.provider));
  return { offers, statuses };
}

type Ref = HotelRef & { provider: string };

/** Group offers into hotels. A group never holds two different hotels from the same provider. */
export function groupOffers(offers: Offer[], mapping: Mapping): { refs: Ref[]; offers: Offer[]; match: MatchKind | 'single' }[] {
  const groups: { refs: Ref[]; offers: Offer[]; match: MatchKind | 'single' }[] = [];
  for (const o of offers) {
    const ref: Ref = { ...o.hotel, provider: o.provider };
    let placed = false;
    for (const g of groups) {
      const sameProvider = g.refs.find((r) => r.provider === ref.provider);
      if (sameProvider && sameProvider.id !== ref.id) continue;
      if (sameProvider) {
        g.offers.push(o);
        placed = true;
        break;
      }
      const kinds = g.refs.map((r) => sameHotel(r, ref, mapping));
      if (kinds.some((k) => k)) {
        g.refs.push(ref);
        g.offers.push(o);
        // The group is only as sure as its weakest join.
        g.match = kinds.includes('strong') || g.match === 'strong' ? 'strong' : 'mapped';
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ refs: [ref], offers: [o], match: 'single' });
  }
  return groups;
}

export async function compare(
  req: SearchRequest,
  providers: Provider[],
  opts: { timeoutMs?: number; mapping?: Mapping; fx?: Fx } = {},
): Promise<CompareResult> {
  const { offers, statuses } = await runProviders(req, providers, opts.timeoutMs ?? 8000);
  const mapping = opts.mapping ?? new Map();
  const fx = opts.fx ?? (() => undefined);
  const hotels: HotelResult[] = groupOffers(offers, mapping).map((g) => {
    const lead = g.refs.find((r) => r.lat != null) ?? g.refs[0];
    return {
      key: g.refs.map((r) => `${r.provider}:${r.id}`).sort().join('|'),
      name: lead.name,
      lat: lead.lat,
      lng: lead.lng,
      stars: g.refs.find((r) => r.stars)?.stars,
      image: g.refs.find((r) => r.image)?.image,
      match: g.match,
      offers: rankOffers(g.offers, req.currency, fx),
      providers: [...new Set(g.refs.map((r) => r.provider))],
    };
  });
  hotels.sort((a, b) => (a.offers[0]?.all.amount ?? Infinity) - (b.offers[0]?.all.amount ?? Infinity));
  return { hotels, providers: statuses, checkedAt: new Date().toISOString() };
}
