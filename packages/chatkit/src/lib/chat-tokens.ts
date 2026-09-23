import type { CSSProperties } from 'react';
import type { Appearance } from '@brett_lamy/ui';

export const KFONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
export const KMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
export const KEASE = 'cubic-bezier(.32,.72,0,1)';

/** The chat color token object (dark) — components use these exact literal values. */
export const chatTokens = {
  bg: '#131318',
  rail: '#0D0D11',
  side: '#101015',
  card: '#1B1B22',
  fill: 'rgba(255,255,255,.055)',
  fill2: 'rgba(255,255,255,.1)',
  hover: 'rgba(255,255,255,.035)',
  sep: 'rgba(255,255,255,.07)',
  label: '#EDEDF2',
  mut: 'rgba(235,235,245,.6)',
  mut3: 'rgba(235,235,245,.35)',
  /** mention / own-reaction text */
  link: '#7EB6FF',
  /** mention chip background */
  mention: 'rgba(10,132,255,.16)',
  /** own-reaction pill background */
  mine: 'rgba(10,132,255,.14)',
  /** text on a neutral fill tile (the rail's inactive workspaces) */
  onFill: '#fff',
  green: '#32D74B',
  orange: '#FF9F0A',
  red: '#FF453A',
  scrim: 'rgba(0,0,0,.5)',
  /** how much black is mixed into user role colors (pastels need deepening on a light background) */
  inkShade: '0%',
};

export type ChatTokens = { [K in keyof typeof chatTokens]: string };

/** The light counterpart of `chatTokens`. */
export const chatLightTokens: ChatTokens = {
  bg: '#FFFFFF',
  rail: '#ECECF0',
  side: '#F7F7F9',
  card: '#F4F4F7',
  fill: 'rgba(0,0,0,.045)',
  fill2: 'rgba(0,0,0,.08)',
  hover: 'rgba(0,0,0,.025)',
  sep: 'rgba(0,0,0,.08)',
  label: '#17171C',
  mut: 'rgba(60,60,67,.72)',
  mut3: 'rgba(60,60,67,.46)',
  link: '#0A64D6',
  mention: 'rgba(10,132,255,.12)',
  mine: 'rgba(10,132,255,.1)',
  onFill: '#3C3C43',
  green: '#1F9D45',
  orange: '#C76A00',
  red: '#E0352B',
  scrim: 'rgba(0,0,0,.25)',
  inkShade: '42%',
};

/** Internal alias matching the prototype's `K` object. */
export const K = chatTokens;

const toVars = (t: ChatTokens) =>
  Object.fromEntries(
    Object.entries(t).map(([k, v]) => ['--ck-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v]),
  ) as CSSProperties;

/** The same tokens emitted as `--ck-*` CSS custom properties (applied on ChatShell's root). */
export const chatTokenVars: CSSProperties = toVars(chatTokens);
export const chatLightTokenVars: CSSProperties = toVars(chatLightTokens);

/** `--ck-*` vars for an appearance. */
export const chatVars = (appearance: Appearance = 'dark'): CSSProperties =>
  appearance === 'light' ? chatLightTokenVars : chatTokenVars;
