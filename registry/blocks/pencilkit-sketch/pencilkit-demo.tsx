/* The PencilKit sketch pad: dotted paper, the canvas, and the floating toolbar. Resting on a tool or a width in the
   toolbar (or tabbing to one) shows a brush preview in a hover card, the way drawing apps preview a brush before you
   pick it: a sample stroke drawn by the real stroke renderer with that tool, in the current ink, at that width. Each
   picker's buttons are triggers of one card (the pickers' `hoverCard`), which follows the button under the pointer or
   keyboard focus with UI SDK's hover intent. */
import * as React from 'react';
import { useState } from 'react';
import { HoverCard, HoverCardContent, HoverCardHeader, createHoverCardController } from '@/components/ui/hover-card';
import { EmptyState } from '@/components/ui/empty-state';
import { pencilInks, pencilToolIcons, pencilWidths, type PencilDrawTool, type PencilPoint, type PencilStroke, type PencilTool } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { PencilActions, PencilInkPicker, PencilToolbar, PencilToolbarPinned, PencilToolPicker, PencilWidthPicker } from '@/components/ui/pencilkit/pencil-toolbar';
import { StrokePath } from '@/components/ui/pencilkit/stroke-path';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';
import { ToolbarSeparator } from '@/components/ui/toolbar';
import { Icon } from '@/lib/icon';
import { themeScopeProps, useAppearance, type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** Dotted paper: the theme's muted surface with a 22px grid of muted-foreground dots. */
export const pencilPaperClassName =
  'bg-muted bg-[length:22px_22px] bg-[radial-gradient(color-mix(in_srgb,var(--muted-foreground)_25%,transparent)_1px,transparent_1.2px)] dark:bg-[radial-gradient(color-mix(in_srgb,var(--muted-foreground)_21%,transparent)_1px,transparent_1.2px)]';

/* ── Brush previews ── */

const TOOL_INFO: Record<PencilTool, { title: string; about: string }> = {
  pen: { title: 'Pen', about: 'Smooth ink that thins as it speeds up and swells with pressure.' },
  marker: { title: 'Marker', about: 'A broad, translucent highlighter: strokes over strokes darken.' },
  pencil: { title: 'Pencil', about: 'A fine, tapered graphite line; light pressure sketches, firm pressure shades.' },
  eraser: { title: 'Eraser', about: 'Removes a whole stroke wherever it touches one.' },
};

/** The sample stroke: an S-curve across a 240×64 swatch. */
const SAMPLE: PencilPoint[] = Array.from({ length: 41 }, (_, i) => {
  const t = i / 40;
  return [16 + t * 208, 32 + Math.sin(t * Math.PI * 2) * 14, 0.5];
});

/** A stroke drawn with `tool` in `ink` at width `w`, on the paper. */
function BrushSample({ tool, ink, w }: { tool: PencilDrawTool; ink: string; w: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 64" className={cn('block h-16 w-full rounded-lg', pencilPaperClassName)}>
      <StrokePath stroke={{ tool, color: ink, width: w, pressure: false, complete: true, points: SAMPLE }} />
    </svg>
  );
}

function BrushCard({ tool, ink, scale, strokes }: { tool: PencilTool; ink: string; scale: number; strokes: number }) {
  const info = TOOL_INFO[tool];
  const width = pencilWidths.find((w) => w.scale === scale);
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader
        icon={<span className="grid size-9 place-items-center rounded-lg bg-secondary text-foreground"><Icon name={pencilToolIcons[tool]} size={20} /></span>}
        title={info.title}
        description={tool === 'eraser' ? `${strokes} stroke${strokes === 1 ? '' : 's'} on the page` : `${width?.label ?? 'Width'} · ${scale}×`} />
      {tool !== 'eraser' ? <BrushSample tool={tool} ink={ink} w={scale} /> : null}
      <p className="m-0 text-footnote text-muted-foreground">{info.about}</p>
    </div>
  );
}

export interface PencilKitDemoProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Dark paper. Wins over `appearance`. */
  dark?: boolean | 'true';
  /** Light or dark paper. Defaults to the ambient `AppearanceProvider` value, else light. */
  appearance?: Appearance;
  tint?: string;
  /** strokes to pre-seed the canvas with (e.g. the `demoStrokes()` fixture) */
  defaultStrokes?: PencilStroke[];
}

/** The full PencilKit prototype demo: dotted paper, canvas, and the floating toolbar. */
export function PencilKitDemo({ dark: darkProp, appearance, tint, defaultStrokes, className, style, ...rest }: PencilKitDemoProps) {
  const ambient = useAppearance();
  const dark = darkProp != null ? darkProp === true || darkProp === 'true' : (appearance ?? ambient) === 'dark';
  const scope = themeScopeProps({ appearance: dark ? 'dark' : 'light', tint });

  const [tool, setTool] = useState<PencilTool>('pen');
  const [ink, setInk] = useState(pencilInks[0].value);
  const [width, setWidth] = useState(1);
  const history = usePencilHistory(defaultStrokes);
  // One card per picker: each of its buttons is a trigger handing the card its tool or width.
  const [toolCard] = useState(() => createHoverCardController<PencilTool>());
  const [widthCard] = useState(() => createHoverCardController<number>());
  // The eraser has no stroke to show; a width previews the tool in hand (the pen, while erasing).
  const drawing: PencilDrawTool = tool === 'eraser' ? 'pen' : tool;

  return (
    <div
      data-slot="pencilkit-demo"
      className={cn(
        'relative h-full w-full overflow-hidden font-sans text-foreground antialiased',
        pencilPaperClassName,
        scope.className,
        className,
      )}
      // the optional tint (--primary / --ring) is chosen at runtime
      style={{ ...scope.style, ...style }}
      {...rest}
    >
      <PencilCanvas
        tool={tool}
        ink={ink}
        width={width}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
        aria-label="Sketch"
        emptyState={<EmptyState title="Draw anywhere" description="Apple Pencil pressure is real; mouse and touch are simulated." />}
      >
        <PencilToolbar className="absolute inset-x-2.5 bottom-3.5 mx-auto">
          <PencilToolPicker value={tool} onValueChange={setTool} hoverCard={toolCard} />
          <ToolbarSeparator />
          <PencilInkPicker value={ink} onValueChange={setInk} />
          <ToolbarSeparator />
          <PencilWidthPicker value={width} onValueChange={setWidth} hoverCard={widthCard} />
          <PencilToolbarPinned>
            <ToolbarSeparator />
            <PencilActions
              onUndo={history.undo}
              onRedo={history.redo}
              onClear={history.clear}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              canClear={history.canClear}
            />
          </PencilToolbarPinned>
        </PencilToolbar>
        <span className="pointer-events-none absolute top-2.5 right-3 font-mono text-caption2 text-tertiary-foreground">perfect-freehand@1.2.2</span>
      </PencilCanvas>
      <HoverCard controller={toolCard}>
        <HoverCardContent<PencilTool> side="top" className="w-64">
          {({ payload }) => (payload != null ? <BrushCard tool={payload} ink={ink} scale={width} strokes={history.strokes.length} /> : null)}
        </HoverCardContent>
      </HoverCard>
      <HoverCard controller={widthCard}>
        <HoverCardContent<number> side="top" className="w-64">
          {({ payload }) => (payload != null ? <BrushCard tool={drawing} ink={ink} scale={payload} strokes={history.strokes.length} /> : null)}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
