import type { CSSProperties } from 'react';

export const KFONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
export const KMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
export const KEASE = 'cubic-bezier(.32,.72,0,1)';

/** The chat color token object — components use these exact literal values. */
export const chatTokens = {
  bg: '#131318',
  rail: '#0D0D11',
  side: '#101015',
  card: '#1B1B22',
  fill: 'rgba(255,255,255,.055)',
  fill2: 'rgba(255,255,255,.1)',
  sep: 'rgba(255,255,255,.07)',
  label: '#EDEDF2',
  mut: 'rgba(235,235,245,.6)',
  mut3: 'rgba(235,235,245,.35)',
  green: '#32D74B',
  orange: '#FF9F0A',
  red: '#FF453A',
} as const;

export type ChatTokens = typeof chatTokens;

/** Internal alias matching the prototype's `K` object. */
export const K = chatTokens;

/** The same tokens emitted as `--ck-*` CSS custom properties (applied on ChatShell's root). */
export const chatTokenVars: CSSProperties = Object.fromEntries(
  Object.entries(chatTokens).map(([k, v]) => ['--ck-' + k, v])
) as CSSProperties;
