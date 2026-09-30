import { describe, expect, it } from 'vitest';
import { THEME_VARS, themeScopeProps, themeVarStyle } from './theme';

describe('ThemeScope props', () => {
  it('maps vars to custom properties', () => {
    expect(themeVarStyle({ radius: '0.25rem', card: '#111', '--custom': '1px' })).toEqual({ '--radius': '0.25rem', '--card': '#111', '--custom': '1px' });
  });
  it('carries an open scope name, the appearance class, the tint and vars', () => {
    const p = themeScopeProps({ scope: 'brand', appearance: 'dark', tint: '#f43', vars: { radius: '0' } });
    expect(p['data-theme-scope']).toBe('brand');
    expect(p.className).toBe('dark scheme-dark');
    expect(p.style).toEqual({ '--primary': '#f43', '--ring': '#f43', '--radius': '0' });
  });
  it('lets vars win over the tint', () => {
    expect(themeScopeProps({ tint: '#f43', vars: { primary: 'red' } }).style).toMatchObject({ '--primary': 'red', '--ring': '#f43' });
  });
  it('lists the variables a theme sets', () => {
    expect(THEME_VARS).toContain('primary');
    expect(THEME_VARS).toContain('tertiary-foreground');
    expect(THEME_VARS).toContain('radius');
  });
});
