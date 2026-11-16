/* BL UI PencilKit — a PencilKit-style drawing surface on perfect-freehand (steveruizok/perfect-freehand).
   Pointer samples [x, y, pressure] → getStroke outline polygon → one filled SVG path per stroke.
   Tools: pen / marker / pencil / stroke eraser · 6 inks · 4 widths · undo / redo / clear. */
import type { StrokeOptions } from 'perfect-freehand';

export type PencilDrawTool = 'pen' | 'marker' | 'pencil';
export type PencilTool = PencilDrawTool | 'eraser';

/** How a drawing tool lays ink: perfect-freehand's options (`size` is the nib at width 1) and the ink's opacity. */
export interface PencilToolDef {
  options: StrokeOptions & { size: number };
  opacity: number;
}

export const pencilTools: Record<PencilDrawTool, PencilToolDef> = {
  pen: { options: { size: 7, thinning: 0.62, smoothing: 0.5, streamline: 0.42 }, opacity: 1 },
  marker: { options: { size: 20, thinning: 0.06, smoothing: 0.55, streamline: 0.5 }, opacity: 0.5 },
  pencil: {
    options: { size: 4.5, thinning: 0.72, smoothing: 0.42, streamline: 0.34, start: { taper: 22 }, end: { taper: 22 } },
    opacity: 0.92,
  },
};

/** The tools' names, for their buttons and tooltips. */
export const pencilToolLabels: Record<PencilTool, string> = { pen: 'Pen', marker: 'Marker', pencil: 'Pencil', eraser: 'Eraser' };

/** The Icon each tool draws. */
export const pencilToolIcons = {
  pen: 'pencil-tip',
  marker: 'highlighter',
  pencil: 'pencil-sketch',
  eraser: 'eraser',
} as const satisfies Record<PencilTool, string>;

/** An ink swatch: the color strokes are drawn with (any CSS color) and its name. */
export interface PencilInk {
  value: string;
  label: string;
}

/** The ink swatches. Black and white follow the theme, as PencilKit's do (black ink reads as white on dark paper);
 *  the hues are Apple's system colors. */
export const pencilInks: readonly PencilInk[] = [
  { value: 'var(--foreground)', label: 'Black' },
  { value: 'var(--background)', label: 'White' },
  { value: '#0A84FF', label: 'Blue' },
  { value: '#30D158', label: 'Green' },
  { value: '#FFD60A', label: 'Yellow' },
  { value: '#FF375F', label: 'Pink' },
];

/** A stroke width: `scale` multiplies the tool's nib (a stroke's `widthScale`), `dot` is the swatch's diameter in px. */
export interface PencilWidth {
  scale: number;
  dot: number;
  label: string;
}

export const pencilWidths: readonly PencilWidth[] = [
  { scale: 0.6, dot: 3, label: 'Fine' },
  { scale: 1, dot: 5, label: 'Regular' },
  { scale: 1.7, dot: 8, label: 'Bold' },
  { scale: 2.6, dot: 11, label: 'Heavy' },
];

/** A pointer sample: x, y and pressure (0–1). */
export type PencilPoint = [number, number, number];

export interface PencilStroke {
  tool: PencilDrawTool;
  /** The stroke's ink: any CSS color (a `pencilInks` value, or your own). */
  ink: string;
  /** Multiplies the tool's nib (a `pencilWidths` scale), so it is not a width in px: the drawn width is
   *  `pencilTools[tool].options.size * widthScale`. */
  widthScale: number;
  /** The points carry real pressure (a stylus); otherwise perfect-freehand simulates it from speed. */
  pressure: boolean;
  points: PencilPoint[];
  /** The pointer has lifted: the stroke's end is drawn with its final taper. */
  complete: boolean;
}
