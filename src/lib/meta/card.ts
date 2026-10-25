// Comparison results in the browser: one card per hotel, one row per offer, cheapest checked offer marked.
// No provider photos or descriptions (Agoda's agreement bars its content on comparison sites).

import type { HotelResult } from './compare';
import type { RankedOffer } from './rank';
import type { ProviderStatus } from './types';

const esc = (t: string) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number, currency = 'ILS') =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

export const PROVIDER_NAMES: Record<string, string> = { agoda: 'Agoda', booking: 'Booking.com' };
const name = (id: string) => PROVIDER_NAMES[id] ?? id;

const BOARD: Record<string, string> = {
  'room-only': 'ללא ארוחות',
  breakfast: 'ארוחת בוקר',
  'half-board': 'חצי פנסיון',
  'full-board': 'פנסיון מלא',
  'all-inclusive': 'הכל כלול',
  unknown: 'ארוחות: לא צוין',
};

function cancel(o: RankedOffer) {
  const c = o.cancellation;
  if (c.kind === 'free') {
    const until = c.until ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(new Date(c.until)) : '';
    return `<span class="mo-tag good">ביטול חינם${until ? ` עד ${until}` : ''}</span>`;
  }
  if (c.kind === 'non-refundable') return '<span class="mo-tag">ללא החזר</span>';
  if (c.kind === 'partial') return '<span class="mo-tag">ביטול בתשלום חלקי</span>';
  return '<span class="mo-tag muted">ביטול: לא צוין</span>';
}

function priceCell(o: RankedOffer, nights: number) {
  const stay = `ל-${nights} לילות${o.rooms > 1 ? `, ${o.rooms} חדרים` : ''}`;
  if (o.all.amount != null) {
    const note = o.price.inclusive === false ? 'כולל תשלום חובה במלון' : 'כולל מיסים ותשלומי חובה';
    return `<b>${money(o.all.amount)}</b><small>${stay} · ${note}${o.all.converted ? ' · הומר לשקלים' : ''}</small>`;
  }
  return `<b class="partial">${money(o.price.total.amount, o.price.total.currency)}</b><small>${stay} · ${esc(o.all.why ?? '')}</small>`;
}

function row(o: RankedOffer, nights: number) {
  return `<li class="mo-row${o.cheapest ? ' best' : ''}">
    <div class="mo-who">
      <b><bdi>${esc(name(o.provider))}</bdi></b>
      ${o.cheapest ? '<span class="mo-best">הזול ביותר מבין ההצעות שנבדקו</span>' : ''}
      <span class="mo-room">${esc(o.roomName ?? 'סוג חדר לא צוין')}</span>
      <span class="mo-tags"><span class="mo-tag">${BOARD[o.board]}</span>${cancel(o)}</span>
    </div>
    <div class="mo-price">${priceCell(o, nights)}</div>
    <a class="btn ${o.cheapest ? 'btn-fire' : 'btn-line'} mo-go" href="${esc(o.url)}" target="_blank" rel="sponsored noopener">ל-<bdi>${esc(name(o.provider))}</bdi> <span class="arrow">←</span></a>
  </li>`;
}

const MATCH: Record<HotelResult['match'], string> = {
  mapped: 'אותו מלון בכל האתרים (אומת)',
  strong: 'אותו מלון לפי שם ומיקום',
  single: '',
};

export function compareCard(h: HotelResult, nights: number) {
  const classes = new Set(h.offers.map((o) => `${o.board}|${o.cancellation.kind}`));
  const mixed = h.offers.length > 1 && classes.size > 1;
  return `<article class="mo">
    <header class="mo-head">
      <div>
        <h3>${esc(h.name)}</h3>
        ${h.stars ? `<span class="hc-stars" aria-label="${h.stars} כוכבים">${'★'.repeat(Math.floor(h.stars))}</span>` : ''}
      </div>
      ${MATCH[h.match] ? `<span class="mo-match">${MATCH[h.match]}</span>` : ''}
    </header>
    ${mixed ? '<p class="mo-warn">ההצעות שונות בארוחות או בתנאי הביטול. השוו את התנאים, לא רק את המחיר.</p>' : ''}
    <ul class="mo-rows">${h.offers.map((o) => row(o, nights)).join('')}</ul>
  </article>`;
}

const STATUS: Record<ProviderStatus['status'], string> = {
  ok: 'נבדק',
  'not-configured': 'לא מחובר',
  unsupported: 'לא תומך בחיפוש הזה',
  error: 'תקלה',
  timeout: 'לא ענה בזמן',
};

export function providerLine(statuses: ProviderStatus[], checkedAt: string) {
  const t = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(new Date(checkedAt));
  const parts = statuses.map(
    (s) =>
      `<span class="ps ${s.status === 'ok' ? 'ok' : 'off'}"><bdi>${esc(name(s.provider))}</bdi>: ${STATUS[s.status]}${
        s.status !== 'ok' && s.reason ? ` (${esc(s.reason)})` : ''
      }</span>`,
  );
  return `<span>נבדק בשעה ${t}:</span> ${parts.join('')}`;
}
