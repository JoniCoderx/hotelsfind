// Client-side rendering of live hotel results (search page, deals, destination pages).
import type { Hotel } from './agoda';
import { partners, type SearchQuery } from './partners';

const esc = (t: string) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const money = (n: number, currency = 'ILS') =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

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
          <b>${money(h.rate, h.currency)}</b><span>ללילה</span>
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
