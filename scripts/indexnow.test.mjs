import { describe, expect, it } from 'vitest';
import { changed, contentHash, locs } from './indexnow.mjs';

describe('IndexNow', () => {
  it('reads sitemap locations', () => {
    expect(locs('<urlset><url><loc>https://malonzol.com/</loc></url><url><loc> https://malonzol.com/guides/ </loc></url></urlset>')).toEqual([
      'https://malonzol.com/',
      'https://malonzol.com/guides/',
    ]);
  });

  it('hashes only the main content', () => {
    const page = (head, body) => `<html><head>${head}</head><body><main>${body}</main></body></html>`;
    expect(contentHash(page('a', 'x'))).toBe(contentHash(page('b', 'x')));
    expect(contentHash(page('a', 'x'))).not.toBe(contentHash(page('a', 'y')));
  });

  it('submits new and changed pages only', () => {
    expect(changed({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' })).toEqual(['b', 'c']);
    expect(changed({}, { a: '1' })).toEqual(['a']);
  });
});
