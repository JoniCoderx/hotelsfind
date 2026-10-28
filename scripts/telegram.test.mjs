import { describe, expect, it } from 'vitest';
import { caption, guideLinks, pageInfo, pick } from './telegram.mjs';

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
});
