// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_CATEGORIES, GOOGLE_FONTS, findGoogleFont, fontStack, googleFontsUrl, loadGoogleFont } from '@/lib/google-fonts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-google-font]').forEach((s) => s.remove());
});

const css = (family: string) => `@font-face { font-family: '${family}'; src: url(https://fonts.gstatic.com/x.woff2) format('woff2'); }`;

describe('the catalog', () => {
  it('lists popular families with their category, weights and italics', () => {
    expect(GOOGLE_FONTS.length).toBeGreaterThan(200);
    const inter = findGoogleFont('inter')!;
    expect(inter.category).toBe('sans-serif');
    expect(inter.variable).toBe(true);
    expect(inter.weights).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(findGoogleFont('Lobster')?.weights).toEqual([400]);
    expect(findGoogleFont('Lobster')?.category).toBe('display');
  });

  it('has families of every category', () => {
    for (const c of FONT_CATEGORIES) expect(GOOGLE_FONTS.some((f) => f.category === c.id)).toBe(true);
  });
});

describe('fontStack', () => {
  it('quotes the family and puts a fallback of its kind behind it', () => {
    expect(fontStack('Playfair Display')).toBe('"Playfair Display", ui-serif, Georgia, serif');
    expect(fontStack('JetBrains Mono')).toBe('"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace');
    expect(fontStack('Not In The List')).toBe('"Not In The List", ui-sans-serif, system-ui, sans-serif');
  });

  it('takes a stack, falling back after the last one by the first one’s kind', () => {
    expect(fontStack(['Inter', 'Roboto'])).toBe('"Inter", "Roboto", ui-sans-serif, system-ui, sans-serif');
    expect(fontStack(['Fira Code'], 'monospace')).toBe('"Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace');
  });

  it('is nothing for no family, so the text inherits', () => {
    expect(fontStack(null)).toBeUndefined();
    expect(fontStack('  ')).toBeUndefined();
    expect(fontStack([])).toBeUndefined();
  });
});

describe('googleFontsUrl', () => {
  it('asks for the weights, the italics and a text subset', () => {
    expect(googleFontsUrl('Open Sans')).toBe('https://fonts.googleapis.com/css2?family=Open+Sans&display=swap');
    expect(googleFontsUrl('Inter', { weights: [700, 400] })).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
    expect(googleFontsUrl('Inter', { weights: [400], italic: true })).toBe('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,400&display=swap');
    expect(googleFontsUrl('Inter', { text: 'Inter' })).toBe('https://fonts.googleapis.com/css2?family=Inter&display=swap&text=Inter');
  });
});

describe('loadGoogleFont', () => {
  it('adds the family’s stylesheet once and resolves when its faces can be used', async () => {
    const fetch = vi.fn(async () => new Response(css('Fraunces'), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn(async () => []) } });
    expect(await loadGoogleFont('Fraunces')).toBe(true);
    expect(await loadGoogleFont('Fraunces')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.head.querySelector('style[data-google-font="Fraunces"]')?.textContent).toContain("font-family: 'Fraunces'");
  });

  it('falls back to the plain family when a style it asked for is refused', async () => {
    const fetch = vi.fn(async (url: string) => (url.includes('ital') ? new Response('', { status: 400 }) : new Response(css('Pacifico'), { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn(async () => []) } });
    expect(await loadGoogleFont('Pacifico Test', { italic: true })).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('resolves false for a family Google Fonts doesn’t have, and can try again later', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    expect(await loadGoogleFont('No Such Family Zz')).toBe(false);
    expect(await loadGoogleFont('No Such Family Zz')).toBe(false);
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
  });
});
