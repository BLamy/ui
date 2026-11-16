/* Freeform's floating chrome: the insert bar (select, hand, draw, shapes, stickies, text, photos, links,
   connectors), the drawing palette (the core PencilToolbar), the zoom cluster and the bar over a selection. Its
   buttons are the kit Toolbar's icon tools (`toolbarButtonVariants`, `toggleVariants`). */
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PencilInkPicker, PencilToolbar, PencilToolPicker, PencilWidthPicker } from '@/components/ui/pencilkit';
import { Separator } from '@/components/ui/separator';
import { toggleVariants } from '@/components/ui/toggle';
import { ToolbarSeparator, toolbarButtonVariants } from '@/components/ui/toolbar';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger, createPopoverController } from '@/components/ui/popover';
import { Icon, type IconShape } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import { toScreen, type Viewport } from '@/lib/canvas-math';
import { boundsOf } from './geometry';
import { unionRect } from '@/lib/canvas-math';
import { G_CONNECTOR, G_SELECT, G_SHAPES } from './glyphs';
import { ShapeGlyph, StickyGlyph } from './glyph-views';
import type { ShapeKind } from './model';
import { ART, STICKY_COLORS } from './palette';
import { SHAPE_KINDS } from './shapes';
import { useFreeform } from './store';
import type { DrawSettings, Tool } from './surface';

/* ── Buttons ── */

/** A 36px icon tool for the board's chrome. It passes every other prop to its SdkButton, so it can be a
 *  popover or menu trigger's `render`. */
export function ToolButton({ icon, shapes, label, children, className, ...rest }: Omit<ComponentProps<typeof SdkButton>, 'children'> & {
  icon?: string; shapes?: readonly IconShape[]; label: string; children?: ReactNode;
}) {
  return (
    <SdkButton aria-label={label} title={label} className={cx(toolbarButtonVariants({ size: 'icon' }), className)} {...rest}>
      {children ?? <Icon name={icon} shapes={shapes} size={21} sw={1.7} />}
    </SdkButton>
  );
}

/** The same tool as a UI SDK Toggle (`aria-pressed`), tinted while pressed: a mode tool, or Lock. */
function ToolToggle({ icon, shapes, label, children, className, ...rest }: Omit<ComponentProps<typeof SdkToggle>, 'children'> & {
  icon?: string; shapes?: readonly IconShape[]; label: string; children?: ReactNode;
}) {
  return (
    <SdkToggle aria-label={label} title={label} className={cx(cn(toggleVariants({ size: 'icon' }), 'rounded-ctl'), className)} {...rest}>
      {children ?? <Icon name={icon} shapes={shapes} size={21} sw={1.7} />}
    </SdkToggle>
  );
}

const cardClass = 'rounded-2xl border border-border bg-card shadow-[0_10px_34px_black] shadow-black/24';

/* ── The insert bar ── */

export interface Inserts {
  sticky: (color: string) => void;
  shape: (kind: ShapeKind) => void;
  text: () => void;
  art: (index: number) => void;
  file: (file: File) => void;
  link: (url: string, title: string) => void;
}

export function InsertBar({ tool, setTool, inserts }: { tool: Tool; setTool: (t: Tool) => void; inserts: Inserts }) {
  const file = useRef<HTMLInputElement>(null);
  const [linkPopover] = useState(() => createPopoverController());
  return (
    <div data-slot="freeform-insert-bar" onPointerDown={(e) => e.stopPropagation()} className={cn('absolute inset-x-2.5 bottom-3.5 mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-0.5 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', cardClass)}>
      {/* The board's modes: toggles, one pressed at a time; releasing a mode goes back to Select. */}
      <ToolToggle shapes={G_SELECT} label="Select (V)" pressed={tool === 'select'} onPressedChange={() => setTool('select')} />
      <ToolToggle icon="hand" label="Move the board (H)" pressed={tool === 'hand'} onPressedChange={(on) => setTool(on ? 'hand' : 'select')} />
      <Separator decorative orientation="vertical" className="mx-1.5 h-5" />
      <ToolToggle icon="pencil-tip" label="Draw (P)" pressed={tool === 'draw'} onPressedChange={(on) => setTool(on ? 'draw' : 'select')} />

      <Popover>
        <PopoverTrigger render={<ToolButton shapes={G_SHAPES} label="Shapes" />} />
        <PopoverContent side="top" className="w-auto p-2.5">
          <div className="grid grid-cols-4 gap-1">
            {SHAPE_KINDS.map((s) => (
              <PopoverClose key={s.kind} aria-label={s.label} title={s.label} onClick={() => inserts.shape(s.kind)} className="grid size-12 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-foreground hover:bg-secondary">
                <ShapeGlyph kind={s.kind} size={30} />
              </PopoverClose>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger render={<ToolButton icon="note" label="Sticky note" />} />
        <PopoverContent side="top" className="w-auto p-2.5">
          <div className="grid grid-cols-3 gap-2">
            {STICKY_COLORS.map((c, i) => (
              <PopoverClose key={c} aria-label={`Sticky note ${i + 1}`} onClick={() => inserts.sticky(c)} className="grid size-14 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent hover:bg-secondary">
                <StickyGlyph tint={c} size={38} />
              </PopoverClose>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <ToolButton icon="textformat" label="Text box" onClick={inserts.text} />

      <Popover>
        <PopoverTrigger render={<ToolButton icon="photo" label="Photo" />} />
        <PopoverContent side="top" className="w-64">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {ART.map((_, i) => (
                <PopoverClose key={i} aria-label={`Sample photo ${i + 1}`} onClick={() => inserts.art(i)} className="block h-14 cursor-pointer overflow-hidden rounded-ctl border-0 p-0">
                  <ArtSwatch index={i} />
                </PopoverClose>
              ))}
            </div>
            <PopoverClose onClick={() => file.current?.click()} className="h-9 cursor-pointer rounded-ctl border-0 bg-secondary px-3 text-detail font-medium hover:bg-secondary-strong">
              Choose from Files…
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) inserts.file(f); e.target.value = ''; }} />

      <Popover controller={linkPopover}>
        <PopoverTrigger render={<ToolButton icon="link" label="Link" />} />
        <PopoverContent side="top" className="w-72">
          <LinkForm onSubmit={(url, title) => { inserts.link(url, title); linkPopover.close(); }} />
        </PopoverContent>
      </Popover>

      <Separator decorative orientation="vertical" className="mx-1.5 h-5" />
      <ToolToggle shapes={G_CONNECTOR} label="Connector (C)" pressed={tool === 'connector'} onPressedChange={(on) => setTool(on ? 'connector' : 'select')} />
    </div>
  );
}

function ArtSwatch({ index }: { index: number }) {
  const a = ART[index];
  return <span className="block size-full" style={{ backgroundImage: `linear-gradient(180deg, ${a.from}, ${a.to})` }} />;
}

function LinkForm({ onSubmit }: { onSubmit: (url: string, title: string) => void }) {
  const [url, setUrl] = useState('');
  const submit = () => {
    const raw = url.trim();
    if (!raw) return;
    let host = raw;
    try { host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).host.replace(/^www\./, ''); } catch { /* keep what was typed */ }
    onSubmit(raw.replace(/^https?:\/\//, ''), host);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-3">
      <input
        value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com/page" aria-label="Link address" autoFocus
        className="h-10 w-full rounded-ctl border-0 bg-secondary px-3 text-detail text-foreground outline-none select-text placeholder:text-tertiary-foreground focus-visible:ring-2 focus-visible:ring-primary"
      />
      <SdkButton onClick={submit} disabled={!url.trim()} className="h-9 cursor-pointer rounded-ctl border-0 bg-primary px-3 text-detail font-semibold text-primary-foreground data-disabled:opacity-40">Add Link</SdkButton>
    </form>
  );
}

/* ── The drawing palette ── */

/** The drawing palette, above the insert bar. The neutral inks follow the theme. */
export function DrawBar({ draw, setDraw }: { draw: DrawSettings; setDraw: (p: Partial<DrawSettings>) => void }) {
  return (
    <PencilToolbar className="absolute inset-x-2.5 bottom-[78px] mx-auto">
      <PencilToolPicker value={draw.tool} onValueChange={(tool) => setDraw({ tool })} />
      <ToolbarSeparator />
      <PencilInkPicker value={draw.ink} onValueChange={(ink) => setDraw({ ink })} />
      <ToolbarSeparator />
      <PencilWidthPicker value={draw.width} onValueChange={(width) => setDraw({ width })} />
    </PencilToolbar>
  );
}

/* ── Zoom ── */

export function ZoomCluster({ zoom, onZoom, onFit, onActual }: { zoom: number; onZoom: (factor: number) => void; onFit: () => void; onActual: () => void }) {
  return (
    <div data-slot="freeform-zoom" onPointerDown={(e) => e.stopPropagation()} className={cn('absolute right-3.5 bottom-3.5 flex items-center gap-0.5 p-1', cardClass)}>
      <ToolButton icon="minus" label="Zoom out (⌘−)" onClick={() => onZoom(0.8)} />
      <SdkButton aria-label="Actual size" title="Actual size (⌘1)" onClick={onActual} className="h-[34px] min-w-[52px] cursor-pointer rounded-[9px] border-0 bg-transparent px-1 text-footnote font-semibold text-muted-foreground tabular-nums hover:bg-secondary">
        {Math.round(zoom * 100)}%
      </SdkButton>
      <ToolButton icon="plus" label="Zoom in (⌘+)" onClick={() => onZoom(1.25)} />
      <Separator decorative orientation="vertical" className="mx-0.5 h-5" />
      <ToolButton icon="arrows-expand" label="Fit to screen (⌘0)" onClick={onFit} />
    </div>
  );
}

/* ── Over a selection ── */

export function SelectionBar({ viewport, size, onEdit }: { viewport: Viewport; size: { width: number; height: number }; onEdit: () => void }) {
  const f = useFreeform();
  const { selected, selection, byId } = f;
  const rect = unionRect(selected.map((i) => boundsOf(i, byId)));
  if (!rect || !selected.length) return null;
  const tl = toScreen(viewport, { x: rect.x, y: rect.y });
  const br = toScreen(viewport, { x: rect.x + rect.w, y: rect.y + rect.h });
  const W = 244;
  const left = Math.max(8, Math.min(size.width - W - 8, (tl.x + br.x) / 2 - W / 2));
  // Above the selection, clear of the rotate handle that sits there; below when there's no room.
  const above = tl.y - 92;
  const top = above >= 8 ? above : Math.min(size.height - 120, br.y + 20);
  const locked = selected.every((i) => i.locked);
  const editable = selected.length === 1 && !selected[0].locked && ['sticky', 'shape', 'text'].includes(selected[0].kind);
  return (
    <div
      data-slot="freeform-selection-bar"
      onPointerDown={(e) => e.stopPropagation()}
      className={cn('absolute flex items-center gap-0.5 p-1', cardClass)}
      style={{ left, top }}
    >
      {editable ? <ToolButton icon="textformat" label="Edit text" onClick={onEdit} /> : null}
      <ToolButton icon="copy" label="Duplicate (⌘D)" onClick={() => f.duplicate(selection)} />
      <DropdownMenu onAction={(k) => f.arrange(selection, k as 'front' | 'back' | 'forward' | 'backward')}>
        <DropdownMenuTrigger render={<ToolButton icon="layers" label="Arrange" />} />
        <DropdownMenuContent side="bottom">
          <DropdownMenuItem value="front" className="min-h-10 py-2">Bring to Front</DropdownMenuItem>
          <DropdownMenuItem value="forward" className="min-h-10 py-2">Bring Forward</DropdownMenuItem>
          <DropdownMenuItem value="backward" className="min-h-10 py-2">Send Backward</DropdownMenuItem>
          <DropdownMenuItem value="back" className="min-h-10 py-2">Send to Back</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolToggle icon={locked ? 'lock-fill' : 'lock-open'} label="Lock" pressed={locked} onPressedChange={(on) => f.setLocked(selection, on)} />
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <ToolButton icon="trash-slim" label="Delete" onClick={() => f.remove(selection)} />
    </div>
  );
}

