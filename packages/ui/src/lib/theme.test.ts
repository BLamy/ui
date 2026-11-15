import { describe, expect, it } from 'vitest';
import { THEME_VARS, contrastRatio, themeScopeProps, themeVarStyle, tintForeground } from './theme';

describe('ThemeScope props', () => {
  it('maps vars to custom properties', () => {
    expect(themeVarStyle({ radius: '0.25rem', card: '#111', '--custom': '1px' })).toEqual({ '--radius': '0.25rem', '--card': '#111', '--custom': '1px' });
  });
  it('carries an open scope name, the appearance class, the tint and vars', () => {
    const p = themeScopeProps({ scope: 'brand', appearance: 'dark', tint: '#f43', vars: { radius: '0' } });
    expect(p['data-theme-scope']).toBe('brand');
    expect(p.className).toBe('dark scheme-dark');
    expect(p.style).toEqual({ '--primary': '#f43', '--primary-foreground': 'oklch(1 0 0)', '--ring': '#f43', '--radius': '0' });
  });
  it('lets vars win over the tint', () => {
    expect(themeScopeProps({ tint: '#f43', vars: { primary: 'red' } }).style).toMatchObject({ '--primary': 'red', '--ring': '#f43' });
  });
  it('gives a tint an ink that reads on it: white while it reaches 3:1, else a near-black', () => {
    for (const tint of ['#0a84ff', '#ff453a', '#bf5af2', '#5e5ce6', '#ac8e68', '#000']) expect(tintForeground(tint)).toBe('oklch(1 0 0)');
    for (const tint of ['#30d158', '#ff9f0a', '#ffd60a', '#64d2ff', 'rgb(255 255 255)', '#fff']) expect(tintForeground(tint)).toBe('oklch(0.2 0 0)');
    // The two the workbench recommends were white at about 2:1; their ink is now over 8:1.
    expect(contrastRatio('#30d158', 'oklch(1 0 0)')).toBeLessThan(2.1);
    expect(contrastRatio('#30d158', tintForeground('#30d158'))).toBeGreaterThan(8);
    expect(contrastRatio('#ff9f0a', tintForeground('#ff9f0a'))).toBeGreaterThan(8);
    // Every tint, from black to white in steps, gets an ink of at least 3:1.
    for (let v = 0; v <= 255; v += 5) {
      for (const tint of [`rgb(${v} ${v} ${v})`, `rgb(${v} ${255 - v} 128)`, `rgb(255 ${v} 0)`]) {
        expect(contrastRatio(tint, tintForeground(tint))).toBeGreaterThanOrEqual(3);
      }
    }
    // A color it can't read here is left to the browser, with the same rule.
    expect(tintForeground('var(--brand)')).toMatch(/^color\(from var\(--brand\) xyz-d65 calc\(/);
  });
  it('lets vars choose the ink on a tint', () => {
    expect(themeScopeProps({ tint: '#30d158', vars: { 'primary-foreground': 'white' } }).style).toMatchObject({ '--primary-foreground': 'white' });
  });
  it('lists the variables a theme sets', () => {
    expect(THEME_VARS).toContain('primary');
    expect(THEME_VARS).toContain('tertiary-foreground');
    expect(THEME_VARS).toContain('radius');
  });
});
