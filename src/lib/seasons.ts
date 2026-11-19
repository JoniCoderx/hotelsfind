// Seasonal content (holiday cards, banners, prices pages) and the day it stops showing.
// Pages are built ahead of time, so a build tells only the state on the day it ran. Each seasonal block is also marked
// with `data-until` (shown until that day) or `data-from` (shown from that day), and an inline script in Base.astro
// hides or shows it in the visitor's browser by today's date: a banner never outlives its holiday if no deploy runs.

export const SEASON_END = {
  /** Hanukkah 2026: evening of 4 Dec to 12 Dec. */
  hanukkah: '2026-12-13',
  /** New Year's Eve 2026: promoted until the night itself. */
  newYear: '2027-01-01',
} as const;

/** Every cutoff day in use, for the inline script and its CSS. */
export const CUTOFFS = [...new Set(Object.values(SEASON_END))];

/** Midnight in Israel at the start of `day` (YYYY-MM-DD). */
export const cutoffTime = (day: string) => Date.parse(`${day}T00:00:00+02:00`);

/** Whether a season is still on, at `now` (the build, unless given). */
export const seasonOn = (key: keyof typeof SEASON_END, now = Date.now()) => now < cutoffTime(SEASON_END[key]);

/** The inline script and CSS for Base.astro's <head>. */
export function seasonHead(): { script: string; css: string } {
  const script = `(function(){var c=${JSON.stringify(CUTOFFS)},r=document.documentElement,n=Date.now();c.forEach(function(d){if(n>=Date.parse(d+'T00:00:00+02:00'))r.classList.add('past-'+d)})})();`;
  const css = CUTOFFS.map((d) => `.past-${d} [data-until="${d}"],html:not(.past-${d}) [data-from="${d}"]{display:none!important}`).join('');
  return { script, css };
}
