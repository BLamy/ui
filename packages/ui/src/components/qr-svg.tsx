import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface QRSvgProps {
  seed: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Decorative deterministic QR-look SVG (not a scannable code). */
export function QRSvg({ seed, size, className, style }: QRSvgProps) {
  size = size || 168; const N = 21, u = size / N;
  let s = 0; for (const ch of seed) s = (s * 33 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const cells: ReactNode[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const corner = (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
    if (!corner && rnd() < .45) cells.push(<rect key={r + '-' + c} x={c * u + u * .04} y={r * u + u * .04} width={u * .92} height={u * .92} rx={u * .28} fill="currentColor" />);
  }
  const eye = (x: number, y: number) => (
    <g key={x + '-' + y}>
      <rect x={x + u * .5} y={y + u * .5} width={6 * u} height={6 * u} rx={u * 1.5} fill="none" stroke="currentColor" strokeWidth={u * .9} />
      <rect x={x + u * 2} y={y + u * 2} width={3 * u} height={3 * u} rx={u * .7} fill="currentColor" />
    </g>
  );
  return (
    <svg data-slot="qr-svg" className={cn(className)} width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}
      style={{ display: 'block', ...style }} aria-hidden="true">
      {cells}{eye(0, 0)}{eye((N - 7) * u, 0)}{eye(0, (N - 7) * u)}
    </svg>
  );
}
