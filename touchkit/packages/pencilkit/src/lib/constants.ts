/* TouchKit PencilKit — a PencilKit-style drawing surface on perfect-freehand (steveruizok/perfect-freehand).
   Pointer samples [x, y, pressure] → getStroke outline polygon → one filled SVG path per stroke.
   Tools: pen / marker / pencil / stroke eraser · 6 inks · 4 widths · undo / redo / clear. */
import type { StrokeOptions } from 'perfect-freehand';

export const PFONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
export const PMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

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

export type PKIconName = 'pen' | 'marker' | 'pencil' | 'eraser' | 'undo' | 'redo' | 'trash';

export const PKI: Record<PKIconName, { d: string }[]> = {
  pen: [{ d: 'M13.2 4.6l6.2 6.2L9 21.2H3.2V15z' }, { d: 'M11 7l6 6' }],
  marker: [{ d: 'M14.6 3.6l5.8 5.8-8.6 8.6H6.4v-5.4z' }, { d: 'M6.4 17.6L4 21.2' }, { d: 'M3 21.2h17' }],
  pencil: [
    { d: 'M4.5 19.5l1-4L16.8 4.2a2 2 0 0 1 2.8 2.8L8.5 18.3l-4 1.2z' },
    { d: 'M14.6 6.4l3 3' },
  ],
  eraser: [
    { d: 'M7.8 20.5h8.7' },
    { d: 'M4.6 15.1l8.3-8.3a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8l-7.4 7.4H8.4a2 2 0 0 1-1.4-.6z' },
    { d: 'M10.3 10.2l4.6 4.6' },
  ],
  undo: [{ d: 'M7.5 9.2H14a5 5 0 0 1 0 10h-3.4' }, { d: 'M10.8 5.8L7.4 9.2l3.4 3.4' }],
  redo: [{ d: 'M16.5 9.2H10a5 5 0 0 0 0 10h3.4' }, { d: 'M13.2 5.8l3.4 3.4-3.4 3.4' }],
  trash: [
    {
      d: 'M5 7h14M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7',
    },
  ],
};

export const PK_LIGHT: Record<string, string> = {
  '--tk-bg': '#fff',
  '--tk-bg2': '#F4F4F7',
  '--tk-card': '#FFFFFF',
  '--tk-label': '#0B0B0F',
  '--tk-label2': 'rgba(60,60,67,.6)',
  '--tk-label3': 'rgba(60,60,67,.38)',
  '--tk-sep': 'rgba(60,60,67,.2)',
  '--tk-fill': 'rgba(120,120,128,.13)',
  '--tk-fill2': 'rgba(120,120,128,.26)',
  '--tk-tint': '#0A84FF',
  '--tk-green': '#34C759',
  '--tk-red': '#FF3B30',
};

export const PK_DARK: Record<string, string> = {
  '--tk-bg': '#000',
  '--tk-bg2': '#101013',
  '--tk-card': '#1C1C1E',
  '--tk-label': '#F5F5F7',
  '--tk-label2': 'rgba(235,235,245,.62)',
  '--tk-label3': 'rgba(235,235,245,.34)',
  '--tk-sep': 'rgba(84,84,88,.52)',
  '--tk-fill': 'rgba(120,120,128,.22)',
  '--tk-fill2': 'rgba(120,120,128,.36)',
  '--tk-tint': '#0A84FF',
  '--tk-green': '#30D158',
  '--tk-red': '#FF453A',
};
