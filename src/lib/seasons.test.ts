import { describe, expect, it } from 'vitest';
import { CUTOFFS, cutoffTime, seasonHead, seasonOn } from './seasons';

describe('seasonal content', () => {
  it('is on until midnight in Israel at the start of its last day', () => {
    expect(seasonOn('hanukkah', Date.parse('2026-12-12T21:59:00Z'))).toBe(true);
    expect(seasonOn('hanukkah', Date.parse('2026-12-12T22:00:00Z'))).toBe(false);
  });
  it('gives the browser a rule for each cutoff', () => {
    const { script, css } = seasonHead();
    for (const d of CUTOFFS) {
      expect(script).toContain(d);
      expect(css).toContain(`.past-${d} [data-until="${d}"]`);
      expect(css).toContain(`html:not(.past-${d}) [data-from="${d}"]`);
    }
    expect(cutoffTime('2027-01-01')).toBe(Date.parse('2026-12-31T22:00:00Z'));
  });
});
