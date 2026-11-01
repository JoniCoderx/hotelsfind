// Client-side rendering of live hotel results (search page, deals, destination pages).
import type { Hotel } from './agoda';
import { partners, type SearchQuery } from './partners';
import { fromIls } from './currency';

const esc = (t: string) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A price for display: shekel amounts in the visitor's currency, others as they are. */
export function money(n: number, currency = 'ILS') {
  const v = currency === 'ILS' ? fromIls(n) : { amount: n, currency };
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: v.currency, maximumFractionDigits: 0 }).format(v.amount);
}

export function scoreLabel(s: number) {
  if (s >= 9) return 'מדהים';
  if (s >= 8.5) return 'מצוין';
  if (s >= 8) return 'טוב מאוד';
  if (s >= 7) return 'טוב';
  return 'סביר';
}

const booking = partners.find((p) => p.id === 'booking')!;

function stars(n: number) {
  const full = Math.floor(n);
  return n ? `<span class="hc-stars" aria-label="${n} כוכבים">${'★'.repeat(full)}${n % 1 ? '½' : ''}</span>` : '';
}

/** One hotel card. `q` carries the dates/guests so the compare link opens the same stay. */
export function hotelCard(h: Hotel, q: SearchQuery & { city?: string }, layout: 'row' | 'tile' = 'row') {
  const compare = booking.build({ ...q, q: [h.name, q.city].filter(Boolean).join(', '), source: 'hotel' });
  return `
  <article class="hc hc-${layout}">
    <a class="hc-img" href="${esc(h.url)}" target="_blank" rel="sponsored noopener">
      <img src="${esc(h.image)}" alt="${esc(h.name)}" loading="lazy" decoding="async" />
      ${h.discount > 0 ? `<span class="hc-deal">‎-${h.discount}%</span>` : ''}
    </a>
    <div class="hc-body">
      <div class="hc-top">
        <div>
          <h3 class="hc-name"><a href="${esc(h.url)}" target="_blank" rel="sponsored noopener">${esc(h.name)}</a></h3>
          ${stars(h.stars)}
        </div>
        ${
          h.score
            ? `<div class="hc-score"><b>${h.score.toFixed(1)}</b><span>${scoreLabel(h.score)}${h.reviews ? `<small>${h.reviews.toLocaleString('he-IL')} חוות דעת</small>` : ''}</span></div>`
            : ''
        }
      </div>
      <div class="hc-perks">
        ${h.breakfast ? '<span class="perk">ארוחת בוקר כלולה</span>' : ''}
        ${h.wifi ? '<span class="perk">WiFi חינם</span>' : ''}
      </div>
      <div class="hc-foot">
        <div class="hc-price">
          <small class="hc-src">מחיר מ-Agoda</small>
          ${h.was > h.rate ? `<s>${money(h.was, h.currency)}</s>` : ''}
          <b>${money(h.rate, h.currency)}</b><span>ללילה, לחדר</span>
          <span class="hc-total">לפני מיסים</span>
        </div>
        <div class="hc-cta">
          <a class="btn btn-fire" href="${esc(h.url)}" target="_blank" rel="sponsored noopener">ל-Agoda <span class="arrow">←</span></a>
          <a class="hc-cmp" href="${esc(compare)}" target="_blank" rel="sponsored noopener">חיפוש המלון ב-Booking</a>
        </div>
      </div>
    </div>
  </article>`;
}

export function skeleton(n: number, layout: 'row' | 'tile' = 'row') {
  return Array.from(
    { length: n },
    () => `<div class="hc hc-${layout} hc-skel" aria-hidden="true"><div class="hc-img"></div><div class="hc-body"><i></i><i></i><i></i></div></div>`,
  ).join('');
}

/** A TripAdvisor photo for a card: its 550px copy. Asking its CDN for the shown size (?w=&h=&s=1) failed: it answers
 *  only some sizes (300x200 worked, 320x200 and 640x400 gave 400 errors), which broke every home-page photo. */
export function sizedImg(url: string, _w: number, _h: number): { src: string; srcset: string } {
  if (!/^https:\/\/dynamic-media-cdn\.tripadvisor\.com\/media\/photo-[a-z]\//.test(url)) return { src: url, srcset: '' };
  return { src: url.split('?')[0].replace(/\/media\/photo-o\//, '/media/photo-s/'), srcset: '' };
}

/** A booking button's words, by where it leads: the hotel (we know its ID on that site), a search around it, or a
 *  Trip.com search we haven't checked yet. See `linkFor` in Compare.astro. */
export function goText(siteName: string, toHotel: boolean, site = ''): string {
  if (toHotel) return `לחיפוש המלון ב-<bdi>${siteName}</bdi>`;
  return site === 'trip' ? `לחיפוש ב-<bdi>${siteName}</bdi> · טרם אומת` : `לחיפוש ב-<bdi>${siteName}</bdi>`;
}

/** Under a button that doesn't target the hotel: what it opens (see goText). Empty when it targets the hotel. */
export function reachText(siteName: string, toHotel: boolean, site = ''): string {
  if (toHotel) return '';
  if (site === 'trip') return `הקישור ל-${siteName} עוד לא נבדק: ייתכן שתצטרכו לחפש שם את המלון בעצמכם.`;
  return `נפתח חיפוש ${site === 'agoda' ? 'בעיר' : 'באזור המלון'} ב-${siteName}, לא המלון עצמו. חפשו שם את המלון.`;
}

/** A short tag for a site's price chip: where its link leads. */
export function reachTag(toHotel: boolean, site = ''): string {
  return toHotel ? 'המלון' : site === 'trip' ? 'טרם אומת' : site === 'agoda' ? 'חיפוש בעיר' : 'חיפוש באזור';
}
