// MalonZol emails: one layout for every message, plus the welcome email and the newsletter.
// Plain JavaScript so both the site (the subscribe endpoint) and scripts/newsletter.mjs can use it.
// The colour bar matches the site's: teal on the left, coral on the right (cells run right to left).
// Email clients ignore most CSS, so the markup is tables with inline styles, right-to-left, 600px wide.

export const SITE = 'https://malonzol.com';
export const FROM = 'מלונזול <hello@malonzol.com>';
export const REPLY_TO = 'hello@malonzol.com';
const INSTAGRAM = 'https://www.instagram.com/malonzoll/';
const TELEGRAM = 'https://t.me/malonzol';

const C = { brand: '#0b2c95', ink: '#121826', muted: '#5b6576', teal: '#12b5a0', sun: '#ffc22e', coral: '#ff5a4f', bg: '#eef2fb', line: '#e3e8f2' };
const FONT = "'Rubik','Segoe UI',Arial,Helvetica,sans-serif";

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Adds UTM tags so visits from email show up in analytics. */
export function track(url, campaign) {
  const u = new URL(url, SITE);
  if (u.origin === SITE) {
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', 'email');
    u.searchParams.set('utm_campaign', campaign);
  }
  return u.toString();
}

/** Israeli law (the "spam law") requires marketing emails to open their subject with the word פרסומת. */
export function adSubject(subject) {
  const s = String(subject).trim();
  return s.startsWith('פרסומת') ? s : `פרסומת: ${s}`;
}

export function button(label, url, color = C.coral) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0"><tr><td style="border-radius:999px;background:${color}">
<a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font:700 17px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)} &larr;</a>
</td></tr></table>`;
}

/**
 * The frame around every email. `unsubscribe` is a URL (broadcasts pass Resend's placeholder) or null for
 * one-off emails, which then explain how to stop them by replying.
 */
export function layout({ preheader = '', body, unsubscribe = null, reason = 'קיבלתם את המייל הזה כי נרשמתם לעדכונים באתר מלונזול.' }) {
  const stop = unsubscribe
    ? `<a href="${esc(unsubscribe)}" style="color:${C.muted};text-decoration:underline">להסרה מרשימת התפוצה</a>`
    : `לא רוצים לקבל מאיתנו מיילים? <a href="mailto:${REPLY_TO}?subject=${encodeURIComponent('הסרה מרשימת התפוצה')}" style="color:${C.muted};text-decoration:underline">השיבו "הסר"</a> ונסיר אתכם.`;
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800&display=swap" rel="stylesheet">
<title>מלונזול</title>
<style>
  @media (max-width:620px){ .w{width:100%!important} .px{padding-left:20px!important;padding-right:20px!important} .h1{font-size:28px!important} .stack{display:block!important;width:100%!important} }
  a{color:${C.brand}}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};direction:rtl">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td style="height:6px;line-height:6px;font-size:0;background:${C.teal}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" style="height:6px;background:${C.coral}"></td><td width="34%" style="height:6px;background:${C.sun}"></td><td width="33%" style="height:6px;background:${C.teal}"></td></tr></table></td></tr>
<tr><td class="px" align="right" style="padding:22px 36px;background:${C.brand}">
<a href="${track(SITE, 'header')}" style="text-decoration:none"><img src="${SITE}/email/logo-light.png" width="150" height="34" alt="מלונזול" style="display:block;border:0;width:150px;height:auto"></a>
</td></tr>
${body}
<tr><td class="px" style="padding:26px 36px;background:#f7f9fd;border-top:1px solid ${C.line};font:400 13px/1.7 ${FONT};color:${C.muted};text-align:right">
<a href="${INSTAGRAM}" style="color:${C.brand};font-weight:700;text-decoration:none">אינסטגרם</a> &nbsp;·&nbsp;
<a href="${TELEGRAM}" style="color:${C.brand};font-weight:700;text-decoration:none">ערוץ טלגרם</a> &nbsp;·&nbsp;
<a href="${track(SITE, 'footer')}" style="color:${C.brand};font-weight:700;text-decoration:none">malonzol.com</a><br>
${esc(reason)} ${stop}<br>
מלונזול, אתר להשוואת מחירי מלונות · <a href="mailto:${REPLY_TO}" style="color:${C.muted}">${REPLY_TO}</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

const p = (html, extra = '') => `<p style="margin:0 0 14px;font:400 17px/1.7 ${FONT};color:${C.ink};${extra}">${html}</p>`;
const h1 = (t) => `<h1 class="h1" style="margin:0 0 14px;font:800 32px/1.2 ${FONT};color:${C.ink}">${esc(t)}</h1>`;
const h2 = (t) => `<h2 style="margin:0 0 14px;font:800 22px/1.3 ${FONT};color:${C.ink}">${esc(t)}</h2>`;
const section = (inner, pad = '30px 36px') => `<tr><td class="px" style="padding:${pad};text-align:right">${inner}</td></tr>`;

function hero(image, alt = '') {
  return image
    ? `<tr><td><img src="${esc(image)}" width="600" alt="${esc(alt)}" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border:0"></td></tr>`
    : '';
}

/** A row of linked guides with their photos. */
function guideList(guides, campaign) {
  return guides
    .map(
      (g) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid ${C.line};border-radius:16px;overflow:hidden"><tr>
<td width="120" style="width:120px">${g.image ? `<a href="${esc(track(g.url, campaign))}"><img src="${esc(g.image)}" width="120" height="90" alt="" style="display:block;width:120px;height:90px;object-fit:cover;border:0"></a>` : ''}</td>
<td style="padding:12px 16px;text-align:right"><a href="${esc(track(g.url, campaign))}" style="font:700 16px/1.4 ${FONT};color:${C.ink};text-decoration:none">${esc(g.title)}</a><br>
<span style="font:500 14px/1.6 ${FONT};color:${C.brand}">לקריאת המדריך &larr;</span></td></tr></table>`,
    )
    .join('');
}

export const WELCOME_SUBJECT = 'ברוכים הבאים למלונזול 👋';

/** Sent once, right after someone subscribes on the site. */
export function welcomeEmail() {
  const c = 'welcome';
  const perks = [
    ['🏷️', 'דילים שבדקנו', 'מלונות במחיר טוב ליעדים שישראלים אוהבים, עם קישור ישר לחיפוש.'],
    ['🗺️', 'איפה לישון', 'מדריכי שכונות קצרים, כדי לבחור אזור לפני שבוחרים מלון.'],
    ['💡', 'טיפים לפני ההזמנה', 'ביטול חינם, מס עירוני ומה עוד בודקים כדי לא לשלם יותר.'],
  ]
    .map(
      ([icon, t, d]) => `<tr><td width="52" valign="top" style="width:52px;padding:0 0 18px;font-size:28px;line-height:1">${icon}</td>
<td valign="top" style="padding:0 0 18px;text-align:right"><div style="font:700 17px/1.4 ${FONT};color:${C.ink}">${t}</div><div style="font:400 15px/1.6 ${FONT};color:${C.muted}">${d}</div></td></tr>`,
    )
    .join('');
  const body =
    hero('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&q=70&w=1200', 'בריכת מלון מול הים') +
    section(
      h1('נעים להכיר, ותודה שנרשמתם') +
        p('מלונזול עוזר לכם למצוא מלון טוב בלי לשלם יותר: מחפשים פעם אחת, ומשווים את אותו מלון בכמה אתרי הזמנות.') +
        p('מה תקבלו מאיתנו במייל:', 'font-weight:700;margin-bottom:18px') +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${perks}</table>` +
        button('לחיפוש מלון', track(SITE + '/#search', c)),
      '30px 36px 10px',
    ) +
    section(
      h2('מדריכים שכדאי להתחיל מהם') +
        guideList(
          [
            { title: 'איפה לישון באילת עם ילדים', url: SITE + '/guides/eilat-family-hotels/', image: 'https://images.unsplash.com/photo-1588784695369-d5412c1bdd18?auto=format&q=60&w=300' },
            { title: 'איפה לישון בלונדון', url: SITE + '/guides/where-to-stay-london/', image: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&q=60&w=300' },
            { title: 'תאילנד בחורף: איפה לישון', url: SITE + '/guides/thailand-winter/', image: 'https://images.pexels.com/photos/9625358/pexels-photo-9625358.jpeg?auto=compress&cs=tinysrgb&w=300' },
          ],
          c,
        ),
      '10px 36px 30px',
    );
  return {
    subject: WELCOME_SUBJECT,
    html: layout({ preheader: 'מה תקבלו מאיתנו, ושלושה מדריכים להתחיל מהם', body }),
  };
}

/**
 * A newsletter issue from a small JSON description:
 * { subject, preheader, title, intro, image, deals: [{ name, city, image, note, price, url }],
 *   guides: [{ title, url, image }], tip, cta: { label, url } }
 * Deal prices are shown as written, so they must be real prices checked on the day.
 */
export function newsletterEmail(issue, { unsubscribe = '{{{RESEND_UNSUBSCRIBE_URL}}}', campaign = 'newsletter' } = {}) {
  const deals = (issue.deals ?? [])
    .map(
      (d) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${C.line};border-radius:18px;overflow:hidden">
${d.image ? `<tr><td><a href="${esc(track(d.url, campaign))}"><img src="${esc(d.image)}" width="526" alt="${esc(d.name)}" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border:0"></a></td></tr>` : ''}
<tr><td style="padding:16px 20px;text-align:right">
<div style="font:500 13px/1.4 ${FONT};color:${C.teal}">${esc(d.city)}</div>
<div style="font:800 20px/1.35 ${FONT};color:${C.ink};margin:2px 0 6px">${esc(d.name)}</div>
${d.note ? `<div style="font:400 15px/1.6 ${FONT};color:${C.muted};margin:0 0 10px">${esc(d.note)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="text-align:right;font:800 18px/1.3 ${FONT};color:${C.brand}">${esc(d.price ?? '')}</td>
<td style="text-align:left"><a href="${esc(track(d.url, campaign))}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:${C.brand};font:700 15px/1 ${FONT};color:#ffffff;text-decoration:none">לבדיקת מחיר &larr;</a></td>
</tr></table></td></tr></table>`,
    )
    .join('');
  const body =
    hero(issue.image, issue.title) +
    section(h1(issue.title) + (issue.intro ? p(esc(issue.intro)) : '') + (issue.cta ? button(issue.cta.label, track(issue.cta.url, campaign)) : ''), '30px 36px 10px') +
    (deals ? section(h2(issue.dealsTitle ?? 'הדילים של השבוע') + deals, '10px 36px 10px') : '') +
    (issue.tip
      ? section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#fff6e0;border-radius:16px;padding:18px 20px;text-align:right">
<div style="font:800 16px/1.4 ${FONT};color:${C.ink};margin-bottom:4px">💡 טיפ לפני שמזמינים</div><div style="font:400 15px/1.6 ${FONT};color:${C.ink}">${esc(issue.tip)}</div></td></tr></table>`, '10px 36px 10px')
      : '') +
    (issue.guides?.length ? section(h2('מדריכים חדשים') + guideList(issue.guides, campaign), '10px 36px 30px') : '');
  return {
    subject: adSubject(issue.subject),
    html: layout({ preheader: issue.preheader ?? '', body, unsubscribe }),
  };
}
