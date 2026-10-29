import { describe, expect, it } from 'vitest';
import { relatedGuides } from './related';

const region = (d?: string) => (d === 'eilat' || d === 'tel-aviv' || d === 'jerusalem' ? 'israel' : 'abroad');
const all = [
  { slug: 'thailand', dest: 'bangkok' },
  { slug: 'hanukkah-abroad' },
  { slug: 'eilat-hanukkah', dest: 'eilat' },
  { slug: 'tel-aviv', dest: 'tel-aviv' },
  { slug: 'london', dest: 'london' },
  { slug: 'eilat-family', dest: 'eilat' },
  { slug: 'jerusalem', dest: 'jerusalem' },
];
const slugs = (g: (typeof all)[number]) => relatedGuides(g, all, region).map((x) => x.slug);

describe('relatedGuides', () => {
  it('puts the same destination first, then the same region', () => {
    expect(slugs(all[5])).toEqual(['eilat-hanukkah', 'tel-aviv', 'jerusalem']);
  });

  it('keeps abroad guides together, treating guides without a destination as abroad', () => {
    expect(slugs(all[4])).toEqual(['thailand', 'hanukkah-abroad', 'eilat-hanukkah']);
  });

  it('never lists the guide itself', () => {
    expect(slugs(all[3])).not.toContain('tel-aviv');
  });
});
