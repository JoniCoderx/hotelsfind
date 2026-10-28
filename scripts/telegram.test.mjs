import { describe, expect, it } from 'vitest';
import { buttons, caption, guideLinks, pageInfo, pick } from './telegram.mjs';
import { cardHtml, logoSvg, photoUrl } from './telegram-card.mjs';

const S = 'https://malonzol.com';
describe('telegram', () => {
  it('lists guides in page order without duplicates', () => {
    const html = '<a href="/guides/b/">x</a><a href="/guides/">all</a><a href="/guides/a/">y</a><a href="/guides/b/">z</a>';
    expect(guideLinks(html)).toEqual([`${S}/guides/b/`, `${S}/guides/a/`]);
  });

  it('reads the H1, description and image', () => {
    const html = '<meta property="og:description" content="תיאור &amp; עוד"><meta property="og:image" content="https://x/i.jpg"><h1 class="t">חנוכה <span>באילת</span></h1>';
    expect(pageInfo(html)).toEqual({ title: 'חנוכה באילת', description: 'תיאור & עוד', image: 'https://x/i.jpg' });
  });

  it('posts new guides first, otherwise one from the back catalogue', () => {
    const links = ['n', 'a', 'b'];
    expect(pick(links, { posted: [], known: ['a', 'b'] })).toEqual(['n']);
    expect(pick(links, { posted: [], known: ['n', 'a', 'b'] })).toEqual(['n']);
    expect(pick(links, { posted: ['n'], known: ['n', 'a', 'b'] })).toEqual(['a']);
    expect(pick(links, { posted: ['n', 'a', 'b'], known: ['n', 'a', 'b'] })).toEqual([]);
    // After a deploy only genuinely new guides go out; the back catalogue waits for the daily run.
    expect(pick(links, { posted: [], known: ['n', 'a', 'b'] }, true)).toEqual([]);
    expect(pick(links, { posted: [], known: ['a', 'b'] }, true)).toEqual(['n']);
  });

  it('escapes HTML and tags the link', () => {
    const { text, link } = caption({ title: 'A<B', description: 'x & y' }, `${S}/guides/a/`);
    expect(text).toContain('<b>A&lt;B</b>');
    expect(text).toContain('x &amp; y');
    expect(link).toBe(`${S}/guides/a/?utm_source=telegram&utm_medium=channel`);
  });

  it('ends the caption with the channel and Instagram', () => {
    const { text } = caption({ title: 'T', description: 'D' }, `${S}/guides/a/`);
    expect(text).toContain('<a href="https://t.me/malonzol">@malonzol</a>');
    expect(text).toContain('https://www.instagram.com/malonzoll/');
  });

  it('adds the guide, Instagram and share buttons', () => {
    const link = `${S}/guides/a/?utm_source=telegram&utm_medium=channel`;
    const rows = buttons('כותרת', link).inline_keyboard;
    expect(rows[0][0].url).toBe(link);
    expect(rows[1][0].url).toBe('https://www.instagram.com/malonzoll/');
    expect(rows[1][1].url).toBe(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('כותרת')}`);
  });
});

describe('telegram card', () => {
  it('turns the Astro logo into plain SVG', () => {
    const svg = logoSvg();
    expect(svg.startsWith('<svg class="logo" viewBox="-261 200 3318 759"')).toBe(true);
    expect(svg).not.toMatch(/[{}]/);
  });

  it('uses the full-size photo behind a Vercel resize', () => {
    const og = 'https://malonzol.com/_vercel/image?url=https%3A%2F%2Fimages.pexels.com%2Fphotos%2F1%2Fp.jpeg%3Fauto%3Dcompress%26w%3D2400&w=1200&q=60';
    expect(photoUrl(og)).toBe('https://images.pexels.com/photos/1/p.jpeg?auto=compress&w=2000');
    expect(photoUrl('https://x/i.jpg')).toBe('https://x/i.jpg');
  });

  it('escapes the title and shows both handles', () => {
    const html = cardHtml({ title: 'A<B', image: 'https://x/i.jpg' }, { logo: '<svg></svg>' });
    expect(html).toContain('<h1>A&lt;B</h1>');
    expect(html).toContain('@malonzol<');
    expect(html).toContain('@malonzoll<');
  });
});
