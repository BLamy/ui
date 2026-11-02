/* The PencilKit sketch pad: dotted paper, the canvas, and the floating toolbar. Resting on a tool or a width in the
   toolbar (or tabbing to one) shows a brush preview in a hover card, the way drawing apps preview a brush before you
   pick it: a sample stroke drawn by the real stroke renderer with that tool, in the current ink, at that width. The
   pickers' buttons belong to the toolbar part, so one card per picker follows the button under the pointer (as a
   Tree's row previews do). */
import * as React from 'react';
import { useRef, useState } from 'react';
import { HoverCard, HoverCardHeader, useHoverCard } from '@/components/ui/hover-card';
import { PK_INKS, PK_TOOL_ICONS, PK_W, type PencilDrawTool, type PencilPoint, type PencilStroke, type PencilTool } from '@/components/ui/pencilkit/constants';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { InkPicker, PencilActions, PencilToolbar, PencilToolbarDivider, ToolPicker, WidthPicker } from '@/components/ui/pencilkit/pencil-toolbar';
import { StrokePath } from '@/components/ui/pencilkit/stroke-path';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';
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
      <StrokePath st={{ tool, color: ink, w, pen: false, done: true, points: SAMPLE }} />
    </svg>
  );
}

function BrushCard({ tool, ink, wi, strokes }: { tool: PencilTool; ink: string; wi: number; strokes: number }) {
  const info = TOOL_INFO[tool];
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader
        media={<span className="grid size-9 place-items-center rounded-lg bg-secondary text-foreground"><Icon name={PK_TOOL_ICONS[tool]} size={20} /></span>}
        title={info.title}
        subtitle={tool === 'eraser' ? `${strokes} stroke${strokes === 1 ? '' : 's'} on the page` : `Width ${wi + 1} · ${PK_W[wi].m}×`} />
      {tool !== 'eraser' ? <BrushSample tool={tool} ink={ink} w={PK_W[wi].m} /> : null}
      <p className="m-0 text-footnote text-muted-foreground">{info.about}</p>
    </div>
  );
}

/** One hover card for a picker's buttons, following the one under the pointer or keyboard focus. `pick` names the
    button's item from its aria-label. */
function usePickerCard<K>(pick: (label: string) => K | null) {
  const card = useHoverCard();
  const button = useRef<HTMLElement | null>(null);
  const [item, setItem] = useState<K | null>(null);
  const at = (target: EventTarget) => {
    const el = (target as Element).closest?.<HTMLElement>('button');
    const k = el ? pick(el.getAttribute('aria-label') ?? '') : null;
    return el && k != null ? { el, k } : null;
  };
  const show = (hit: { el: HTMLElement; k: K }) => {
    button.current = hit.el;
    setItem(() => hit.k);
  };
  const handlers = {
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const hit = at(e.target);
      if (!hit) { button.current = null; card.triggerProps.onPointerLeave(e); return; }
      if (hit.el === button.current) return;
      card.close();
      show(hit);
      card.triggerProps.onPointerEnter(e);
    },
    onPointerLeave: (e: React.PointerEvent) => { button.current = null; card.triggerProps.onPointerLeave(e); },
    onFocus: (e: React.FocusEvent) => {
      const hit = at(e.target);
      if (!hit || !(e.target as Element).matches(':focus-visible')) return;
      show(hit);
      card.open();
    },
    onBlur: card.triggerProps.onBlur,
    // A press picks it: the card has said its piece.
    onPointerDown: () => card.close(),
  };
  return { handlers, item, cardProps: { ...card.cardProps, triggerRef: button } };
}

const TOOLS: PencilTool[] = ['pen', 'marker', 'pencil', 'eraser'];

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
  const [ink, setInk] = useState(dark ? 1 : 0);
  const [wi, setWi] = useState(1);
  const history = usePencilHistory(defaultStrokes);
  const toolCard = usePickerCard((label) => TOOLS.find((t) => t === label) ?? null);
  const widthCard = usePickerCard((label) => (/^Width (\d+)$/.test(label) ? Number(label.slice(6)) - 1 : null));
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
        ink={PK_INKS[ink]}
        width={PK_W[wi].m}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
        status="perfect-freehand@1.2.2"
        hint={
          <>
            <div className="text-[15.5px] font-semibold">Draw anywhere</div>
            <div className="mt-[3px] text-[12.5px]">
              Apple Pencil pressure is real — mouse and touch are simulated.
            </div>
          </>
        }
      >
        <PencilToolbar>
          <ToolPicker value={tool} onChange={setTool} {...toolCard.handlers} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onChange={setWi} {...widthCard.handlers} />
          <PencilToolbarDivider />
          <PencilActions
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={history.clear}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </PencilToolbar>
      </PencilCanvas>
      {toolCard.item != null ? (
        <HoverCard {...toolCard.cardProps} placement="top" className="w-64">
          <BrushCard tool={toolCard.item} ink={PK_INKS[ink]} wi={wi} strokes={history.strokes.length} />
        </HoverCard>
      ) : null}
      {widthCard.item != null ? (
        <HoverCard {...widthCard.cardProps} placement="top" className="w-64">
          <BrushCard tool={drawing} ink={PK_INKS[ink]} wi={widthCard.item} strokes={history.strokes.length} />
        </HoverCard>
      ) : null}
    </div>
  );
}
