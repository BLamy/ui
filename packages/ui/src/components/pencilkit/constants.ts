/* BL UI PencilKit — a PencilKit-style drawing surface on perfect-freehand (steveruizok/perfect-freehand).
   Pointer samples [x, y, pressure] → getStroke outline polygon → one filled SVG path per stroke.
   Tools: pen / marker / pencil / stroke eraser · 6 inks · 4 widths · undo / redo / clear. */
import type { StrokeOptions } from 'perfect-freehand';

export type PencilDrawTool = 'pen' | 'marker' | 'pencil';
export type PencilTool = PencilDrawTool | 'eraser';

export interface PencilToolDef {
  opt: StrokeOptions & { size: number };
  alpha: number;
}

export const PK_TOOLS: Record<PencilDrawTool, PencilToolDef> = {
  pen: { opt: { size: 7, thinning: 0.62, smoothing: 0.5, streamline: 0.42 }, alpha: 1 },
  marker: { opt: { size: 20, thinning: 0.06, smoothing: 0.55, streamline: 0.5 }, alpha: 0.5 },
  pencil: {
    opt: { size: 4.5, thinning: 0.72, smoothing: 0.42, streamline: 0.34, start: { taper: 22 }, end: { taper: 22 } },
    alpha: 0.92,
  },
};

/** The ink swatches (content colors: they are drawn into the strokes, so they don't follow the theme). */
export const PK_INKS = ['#1C1C1E', '#F2F2F7', '#0A84FF', '#30D158', '#FFD60A', '#FF375F'];

export const PK_W: { m: number; d: number }[] = [
  { m: 0.6, d: 3 },
  { m: 1, d: 5 },
  { m: 1.7, d: 8 },
  { m: 2.6, d: 11 },
];

export type PencilPoint = [number, number, number];

export interface PencilStroke {
  tool: PencilDrawTool;
  color: string;
  w: number;
  pen: boolean;
  points: PencilPoint[];
  done: boolean;
}

/** The Icon each tool draws (the former PencilKit icon set now lives in `Icon`). */
export const PK_TOOL_ICONS = {
  pen: 'pencil-tip',
  marker: 'highlighter',
  pencil: 'pencil-sketch',
  eraser: 'eraser',
} as const satisfies Record<PencilTool, string>;
