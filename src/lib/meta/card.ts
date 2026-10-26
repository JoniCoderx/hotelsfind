// Comparison results in the browser: one card per hotel, the best offer from each booking site.
// "Cheapest" only when complete prices from at least two different sites were compared for that hotel.
// No connector photos or descriptions (Agoda's agreement bars its content on comparison sites).

import type { HotelResult } from './compare';
import { offerClass, type RankedOffer } from './rank';
import type { ConnectorStatus } from './types';

const esc = (t: string) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (n: number, currency = 'ILS') =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
const day = (iso: string) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(new Date(iso));

const CONNECTOR: Record<string, string> = { 'agoda-search': 'Agoda', 'booking-demand': 'Booking.com', vio: 'Vio.com' };

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
  if (c.kind === 'free') return `<span class="mo-tag good">ביטול חינם${c.until ? ` עד ${day(c.until)}` : ''}</span>`;
  if (c.kind === 'non-refundable') return '<span class="mo-tag">ללא החזר</span>';
  if (c.kind === 'partial') return '<span class="mo-tag">ביטול בתשלום חלקי</span>';
  return '<span class="mo-tag muted">ביטול: לא צוין</span>';
}

function priceCell(o: RankedOffer, nights: number) {
  const stay = `ל-${nights} לילות`;
  if (o.all.amount != null) {
    const note = o.price.inclusive === false ? 'כולל תשלום חובה במלון' : 'כולל מיסים ותשלומי חובה';
    const fx = o.all.fx ? ` · הומר מ-${o.all.fx.from} לפי שער מ-${day(o.all.fx.at)}; התשלום ב-${o.all.fx.from}` : '';
    return `<b>${money(o.all.amount)}</b><small>${stay} · ${note}${fx}</small>`;
  }
  return `<b class="partial">${money(o.price.total.amount, o.price.total.currency)}</b><small>${stay} · מחיר חלקי: ${esc(o.all.why ?? '')}</small>`;
}

function row(o: RankedOffer, nights: number, sites: number, more: number) {
  return `<li class="mo-row${o.cheapest ? ' best' : ''}">
    <div class="mo-who">
      <b><bdi>${esc(o.site.name)}</bdi></b>
      ${o.via ? `<span class="mo-via">דרך <bdi>${esc(o.via)}</bdi> · ייתכן שהמוכר בפועל אחר</span>` : ''}
      ${o.cheapest ? `<span class="mo-best">הזול מבין ההצעות שנבדקו ב-${sites} אתרים</span>` : ''}
      <span class="mo-room">${esc(o.roomName ?? 'סוג חדר לא צוין')}</span>
      <span class="mo-tags"><span class="mo-tag">${BOARD[o.board]}</span>${cancel(o)}</span>
      ${more ? `<span class="mo-more">ועוד ${more} הצעות מאותו אתר</span>` : ''}
    </div>
    <div class="mo-price">${priceCell(o, nights)}</div>
    <a class="btn ${o.cheapest ? 'btn-fire' : 'btn-line'} mo-go" href="${esc(o.url)}" target="_blank" rel="sponsored noopener">ל-<bdi>${esc(o.site.name)}</bdi> <span class="arrow">←</span></a>
  </li>`;
}

export function compareCard(h: HotelResult, nights: number) {
  // Best offer per booking site (offers arrive ranked), so one site's many rooms don't look like many sites.
  const bySite = new Map<string, { best: RankedOffer; count: number }>();
  for (const o of h.offers) {
    const s = bySite.get(o.site.id);
    if (s) s.count++;
    else bySite.set(o.site.id, { best: o, count: 1 });
  }
  const shown = [...bySite.values()];
  const mixed = shown.length > 1 && new Set(shown.map((s) => offerClass(s.best))).size > 1;
  return `<article class="mo">
    <header class="mo-head">
      <div>
        <h3>${esc(h.name)}</h3>
        ${h.stars ? `<span class="hc-stars" aria-label="${h.stars} כוכבים">${'★'.repeat(Math.floor(h.stars))}</span>` : ''}
      </div>
    </header>
    ${
      h.sitesCompared >= 2
        ? `<p class="mo-note">נמצאו מחירים כוללים מ-${h.sitesCompared} אתרים למלון הזה.</p>`
        : '<p class="mo-note">אין כאן השוואה מלאה: פחות משני אתרים נתנו מחיר כולל למלון הזה.</p>'
    }
    ${mixed ? '<p class="mo-warn">ההצעות שונות בארוחות או בתנאי הביטול, או שחלק מהתנאים לא צוינו. השוו את התנאים, לא רק את המחיר.</p>' : ''}
    <ul class="mo-rows">${shown.map((s) => row(s.best, nights, h.sitesCompared, s.count - 1)).join('')}</ul>
  </article>`;
}

const STATUS: Record<ConnectorStatus['status'], string> = {
  ok: 'ענה',
  partial: 'ענה חלקית',
  'not-configured': 'לא מחובר',
  unsupported: 'לא תומך בחיפוש הזה',
  error: 'תקלה',
  timeout: 'לא ענה בזמן',
};

export function connectorLine(statuses: ConnectorStatus[], checkedAt: string) {
  const t = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(new Date(checkedAt));
  const parts = statuses.map(
    (s) =>
      `<span class="ps ${s.status === 'ok' ? 'ok' : 'off'}"><bdi>${esc(CONNECTOR[s.source] ?? s.source)}</bdi>: ${STATUS[s.status]}${
        s.status !== 'ok' && 'reason' in s && s.reason ? ` (${esc(s.reason)})` : ''
      }</span>`,
  );
  return `<span>נבדק בשעה ${t}:</span> ${parts.join('')}`;
}
