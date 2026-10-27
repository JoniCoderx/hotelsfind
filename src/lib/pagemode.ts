// The deployment's price mode as seen by browser scripts (Base.astro writes it into a meta tag).
export const pageLive = () => document.querySelector('meta[name="price-mode"]')?.getAttribute('content') === 'live';
