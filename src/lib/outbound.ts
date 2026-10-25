// Outbound clicks to booking sites: which partner, where on the page, and whether the link
// carries an affiliate ID. Clicks are not bookings; compare these counts with partner reports.
import { inject, track } from '@vercel/analytics';

const PLACES: [string, string][] = [
  ['.hc', 'hotel-card'],
  ['#compare-links', 'compare-row'],
  ['.links', 'fallback-list'],
  ['.side', 'destination-links'],
  ['.cmp', 'hotel-page-links'],
  ['#rate-out', 'hotel-page-price'],
];

function describe(a: HTMLAnchorElement) {
  let u = new URL(a.href);
  let route = 'direct';
  if (u.hostname === 'tp.media') {
    route = 'travelpayouts';
    u = new URL(u.searchParams.get('u') || a.href);
  } else if (['aid', 'cid', 'affcid', 'Allianceid'].some((k) => u.searchParams.get(k))) {
    route = 'affiliate-id';
  }
  const partner = u.hostname.replace(/^www\./, '').split('.')[0];
  const place = PLACES.find(([sel]) => a.closest(sel))?.[1] ?? 'other';
  return { partner, place, route, page: location.pathname };
}

/** Keep only campaign tags (utm_*) in reported URLs: searches carry dates and children's ages. */
export function scrubUrl(url: string): string {
  const u = new URL(url);
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (k.startsWith('utm_')) keep.append(k, v);
  u.search = keep.toString();
  u.hash = '';
  return u.toString();
}

/** First campaign that brought this visitor in this tab, sent with each outbound click. */
function campaign(): string {
  try {
    const now = new URLSearchParams(location.search).get('utm_source');
    if (now) sessionStorage.setItem('mz-src', now);
    return sessionStorage.getItem('mz-src') || (document.referrer ? new URL(document.referrer).hostname : 'direct');
  } catch {
    return 'unknown';
  }
}

export function trackOutbound() {
  inject({ beforeSend: (e) => ({ ...e, url: scrubUrl(e.url) }) });
  const src = campaign();
  // One event per real activation: left click and Enter fire `click`, middle click fires `auxclick`.
  const onOut = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[rel~="sponsored"]');
    if (a) track('outbound', { ...describe(a), src });
  };
  document.addEventListener('click', onOut, { capture: true });
  document.addEventListener('auxclick', onOut, { capture: true });
}
