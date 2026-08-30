import * as React from 'react';
import { getStroke } from 'perfect-freehand';
import { PK_TOOLS, type PencilStroke } from './constants';

export function outlinePath(pts: number[][]): string {
  if (!pts || pts.length < 3) return '';
  let d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2) + 'Q';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    d +=
      a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' ' +
      ((a[0] + b[0]) / 2).toFixed(2) + ' ' + ((a[1] + b[1]) / 2).toFixed(2) + ' ';
  }
  return d + 'Z';
}

export interface StrokePathProps {
  st: PencilStroke;
  /** Set false to render the plain (non perfect-freehand) fallback path. Default true. */
  pf?: boolean;
}

export function StrokePath({ st, pf = true }: StrokePathProps) {
  const T = PK_TOOLS[st.tool];
  if (pf) {
    const pts = getStroke(st.points, {
      ...T.opt,
      size: T.opt.size * st.w,
      simulatePressure: !st.pen,
      last: !!st.done,
    });
    return <path d={outlinePath(pts)} fill={st.color} fillOpacity={T.alpha} />;
  }
  const d = st.points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return (
    <path
      d={d}
      fill="none"
      stroke={st.color}
      strokeOpacity={T.alpha}
      strokeWidth={T.opt.size * st.w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export const MemoStroke = React.memo(StrokePath);
