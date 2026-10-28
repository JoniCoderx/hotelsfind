// The image that goes with each Telegram post: the guide's photo with the MalonZol logo, the title and the
// channel handles, rendered at 1080x1350 in headless Chromium (the description goes in the caption). Fonts
// come from @fontsource and the logo from src/components/Logo.astro, so the card matches the site.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const W = 1080;
export const H = 1350;
export const TELEGRAM = '@malonzol';
export const INSTAGRAM = '@malonzoll';

const root = fileURLToPath(new URL('..', import.meta.url));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The wordmark from Logo.astro as plain SVG markup. */
export function logoSvg(astro = readFileSync(`${root}src/components/Logo.astro`, 'utf8')) {
  const svg = astro.match(/<svg[\s\S]*?<\/svg>/)[0];
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  // The opening tag carries Astro expressions; swap it for a plain one.
  return svg.replace(/^<svg[^>]*?aria-label="[^"]*"\s*>/, `<svg class="logo" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`);
}

/** The full-size photo behind a share image: the original Pexels file rather than the 1200px resize. */
export function photoUrl(image) {
  try {
    const u = new URL(image);
    const src = u.pathname === '/_vercel/image' ? u.searchParams.get('url') : null;
    if (!src) return image;
    const p = new URL(src);
    if (p.hostname === 'images.pexels.com') p.searchParams.set('w', '2000');
    return p.toString();
  } catch {
    return image;
  }
}

function fontFaces() {
  const require = createRequire(import.meta.url);
  const dir = require.resolve('@fontsource/rubik/package.json').replace(/package\.json$/, 'files/');
  return [500, 700, 800]
    .flatMap((w) =>
      ['hebrew', 'latin'].map((s) => {
        const b64 = readFileSync(`${dir}rubik-${s}-${w}-normal.woff2`).toString('base64');
        return `@font-face{font-family:Rubik;font-weight:${w};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
      }),
    )
    .join('\n');
}

const tgIcon =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5l18.9-7.3c.9-.3 1.6.2 1.4 1.6Z"/></svg>';
const igIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>';

/** The card as a standalone HTML page. */
export function cardHtml({ title, image }, { fonts = '', logo = logoSvg() } = {}) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${fonts}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0b1f5c}
body{font-family:Rubik,sans-serif;color:#fff;position:relative}
.photo{position:absolute;inset:0;background:#0b1f5c center/cover no-repeat url("${esc(photoUrl(image))}")}
.shade{position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(6,16,48,.5) 0%,rgba(6,16,48,0) 20%,rgba(6,16,48,0) 42%,rgba(6,16,48,.82) 72%,rgba(6,16,48,.97) 100%)}
.brand{position:absolute;top:56px;right:56px;background:#fff;border-radius:999px;padding:22px 34px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.logo{display:block;height:58px;width:auto}
.logo .ink{fill:#0b1f5c}.logo .z{fill:#ff5a4f}.logo .v{fill:#ffb400}.logo .l{fill:#12b5a0}
.body{position:absolute;right:64px;left:64px;bottom:200px}
.kicker{display:inline-block;background:#ffb400;color:#0b1f5c;font-weight:800;font-size:30px;padding:10px 24px;border-radius:999px;margin-bottom:28px}
h1{font-weight:800;font-size:92px;line-height:1.08;letter-spacing:-.5px;text-wrap:balance;text-shadow:0 4px 24px rgba(0,0,0,.35)}
.foot{position:absolute;right:64px;left:64px;bottom:64px;display:flex;align-items:center;gap:20px;
  padding-top:34px;border-top:2px solid rgba(255,255,255,.22)}
.h{display:inline-flex;align-items:center;gap:12px;font-weight:700;font-size:32px;direction:ltr}
.h svg{width:38px;height:38px}
.tg svg{color:#5fc4ff}.ig svg{color:#ff7aa8}
.site{margin-inline-start:auto;font-weight:500;font-size:30px;color:rgba(255,255,255,.75);direction:ltr}
</style></head><body>
<div class="photo"></div><div class="shade"></div>
<div class="brand">${logo}</div>
<div class="body"><span class="kicker">מדריך</span><h1>${esc(title)}</h1></div>
<div class="foot"><span class="h tg">${tgIcon}${TELEGRAM}</span><span class="h ig">${igIcon}${INSTAGRAM}</span><span class="site">malonzol.com</span></div>
<script>
  // Long titles step down until they fit in three lines.
  const h = document.querySelector('h1');
  for (let s = 92; s > 56 && h.offsetHeight > s * 1.08 * 3 + 4; s -= 4) h.style.fontSize = s + 'px';
</script>
</body></html>`;
}

/** Renders the card to a JPEG buffer. Needs the playwright package and its Chromium. */
export async function renderCard(info) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.setContent(cardHtml(info, { fonts: fontFaces() }), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    const ok = await page.evaluate(
      (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; }),
      photoUrl(info.image),
    );
    if (!ok) throw new Error(`photo did not load: ${info.image}`);
    return await page.screenshot({ type: 'jpeg', quality: 88 });
  } finally {
    await browser.close();
  }
}
