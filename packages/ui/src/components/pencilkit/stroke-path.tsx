'use client';
import * as React from 'react';
import { getStroke } from 'perfect-freehand';
import { pencilTools, type PencilStroke } from '@/components/ui/pencilkit/constants';

/** perfect-freehand's outline polygon as a smooth closed SVG path. */
function outlinePath(pts: number[][]): string {
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
  stroke: PencilStroke;
  /** `freehand` (default) fills perfect-freehand's pressure outline; `plain` strokes the raw polyline. */
  variant?: 'freehand' | 'plain';
}

/** One stroke as an SVG `<path>`, for an `<svg>` in the stroke's own coordinates. Memoized: a drawing re-renders
 *  only the stroke that changed. */
export const StrokePath = React.memo(function StrokePath({ stroke, variant = 'freehand' }: StrokePathProps) {
  const tool = pencilTools[stroke.tool];
  if (variant === 'freehand') {
    const pts = getStroke(stroke.points, {
      ...tool.options,
      size: tool.options.size * stroke.widthScale,
      simulatePressure: !stroke.pressure,
      last: stroke.complete,
    });
    return <path d={outlinePath(pts)} fill={stroke.ink} fillOpacity={tool.opacity} />;
  }
  const d = stroke.points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke.ink}
      strokeOpacity={tool.opacity}
      strokeWidth={tool.options.size * stroke.widthScale}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});
