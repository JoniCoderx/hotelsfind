import type { APIRoute } from 'astro';

export const prerender = false;

// Rough rates for when the ECB feed can't be reached: units per shekel.
const FALLBACK = { ILS: 1, USD: 0.3, EUR: 0.28, GBP: 0.24 };

/** Units of each currency we show per shekel, from the ECB's daily rates (via frankfurter). */
export const GET: APIRoute = async () => {
  let rates = FALLBACK;
  let cache = 'public, s-maxage=600';
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=ILS&symbols=USD,EUR,GBP', { signal: AbortSignal.timeout(4000) });
    const r = (await res.json())?.rates ?? {};
    if ([r.USD, r.EUR, r.GBP].every((v) => typeof v === 'number' && v > 0.05 && v < 1)) {
      rates = { ILS: 1, USD: r.USD, EUR: r.EUR, GBP: r.GBP };
      cache = 'public, s-maxage=43200, stale-while-revalidate=86400';
    }
  } catch {}
  return new Response(JSON.stringify(rates), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });
};
