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

export function trackOutbound() {
  // Report pages without their query string: searches carry dates and children's ages.
  inject({ beforeSend: (e) => ({ ...e, url: e.url.split('?')[0] }) });
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[rel~="sponsored"]');
      if (a) track('outbound', describe(a));
    },
    { capture: true },
  );
}
