/* Freeform's floating chrome: the insert bar (select, hand, draw, shapes, stickies, text, photos, links,
   connectors), the drawing palette (the core PencilToolbar), the zoom cluster and the bar over a selection. */
import { useRef, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PK_INKS, PK_W, type PencilTool } from '@/components/ui/pencilkit/constants';
import { InkPicker, PencilToolbar, PencilToolbarDivider, ToolPicker, WidthPicker, pencilToolButtonVariants } from '@/components/ui/pencilkit/pencil-toolbar';
import { PlainButton } from '@/components/ui/plain-button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { toScreen } from './camera';
import { boundsOf, unionRect } from './geometry';
import { G_CONNECTOR, G_SELECT, G_SHAPES } from './glyphs';
import { ShapeGlyph, StickyGlyph } from './glyph-views';
import type { Camera, ShapeKind } from './model';
import { ART, STICKY_COLORS } from './palette';
import { SHAPE_KINDS } from './shapes';
import { useFreeform } from './store';
import type { DrawSettings, Tool } from './canvas';

/* ── Buttons ── */

export function ToolButton({ icon, shapes, label, active, onPress, children }: {
  icon?: string; shapes?: readonly IconShape[]; label: string; active?: boolean; onPress?: () => void; children?: ReactNode;
}) {
  return (
    <PlainButton aria-label={label} title={label} onPress={onPress} className={pencilToolButtonVariants({ active: !!active })}>
      {children ?? <Icon name={icon} shapes={shapes} size={21} sw={1.7} />}
    </PlainButton>
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
  return (
    <div data-slot="freeform-insert-bar" onPointerDown={(e) => e.stopPropagation()} className={cn('absolute inset-x-2.5 bottom-3.5 mx-auto flex w-fit max-w-[calc(100%-20px)] items-center gap-0.5 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', cardClass)}>
      <ToolButton shapes={G_SELECT} label="Select (V)" active={tool === 'select'} onPress={() => setTool('select')} />
      <ToolButton icon="hand" label="Move the board (H)" active={tool === 'hand'} onPress={() => setTool('hand')} />
      <PencilToolbarDivider className="mx-1.5" />
      <ToolButton icon="pencil-tip" label="Draw (P)" active={tool === 'draw'} onPress={() => setTool(tool === 'draw' ? 'select' : 'draw')} />

      <PopoverTrigger>
        <ToolButton shapes={G_SHAPES} label="Shapes" />
        <PopoverContent placement="top" aria-label="Shapes" className="w-auto p-2.5">
          {({ close }) => (
            <div className="grid grid-cols-4 gap-1">
              {SHAPE_KINDS.map((s) => (
                <PlainButton key={s.kind} aria-label={s.label} title={s.label} onPress={() => { inserts.shape(s.kind); close(); }} className="grid size-12 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-foreground hover:bg-secondary">
                  <ShapeGlyph kind={s.kind} size={30} />
                </PlainButton>
              ))}
            </div>
          )}
        </PopoverContent>
      </PopoverTrigger>

      <PopoverTrigger>
        <ToolButton icon="note" label="Sticky note" />
        <PopoverContent placement="top" aria-label="Sticky notes" className="w-auto p-2.5">
          {({ close }) => (
            <div className="grid grid-cols-3 gap-2">
              {STICKY_COLORS.map((c, i) => (
                <PlainButton key={c} aria-label={`Sticky note ${i + 1}`} onPress={() => { inserts.sticky(c); close(); }} className="grid size-14 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent hover:bg-secondary">
                  <StickyGlyph color={c} size={38} />
                </PlainButton>
              ))}
            </div>
          )}
        </PopoverContent>
      </PopoverTrigger>

      <ToolButton icon="textformat" label="Text box" onPress={inserts.text} />

      <PopoverTrigger>
        <ToolButton icon="photo" label="Photo" />
        <PopoverContent placement="top" aria-label="Photos" className="w-64">
          {({ close }) => (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {ART.map((_, i) => (
                  <PlainButton key={i} aria-label={`Sample photo ${i + 1}`} onPress={() => { inserts.art(i); close(); }} className="block h-14 cursor-pointer overflow-hidden rounded-ctl border-0 p-0">
                    <ArtSwatch index={i} />
                  </PlainButton>
                ))}
              </div>
              <PlainButton onPress={() => { close(); file.current?.click(); }} className="h-9 cursor-pointer rounded-ctl border-0 bg-secondary px-3 text-detail font-medium hover:bg-secondary-strong">
                Choose from Files…
              </PlainButton>
            </div>
          )}
        </PopoverContent>
      </PopoverTrigger>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) inserts.file(f); e.target.value = ''; }} />

      <PopoverTrigger>
        <ToolButton icon="link" label="Link" />
        <PopoverContent placement="top" aria-label="Add a link" className="w-72">
          {({ close }) => <LinkForm onSubmit={(url, title) => { inserts.link(url, title); close(); }} />}
        </PopoverContent>
      </PopoverTrigger>

      <PencilToolbarDivider className="mx-1.5" />
      <ToolButton shapes={G_CONNECTOR} label="Connector (C)" active={tool === 'connector'} onPress={() => setTool(tool === 'connector' ? 'select' : 'connector')} />
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
      <PlainButton onPress={submit} isDisabled={!url.trim()} className="h-9 cursor-pointer rounded-ctl border-0 bg-primary px-3 text-detail font-semibold text-primary-foreground data-disabled:opacity-40">Add Link</PlainButton>
    </form>
  );
}

/* ── The drawing palette ── */

export function DrawBar({ draw, setDraw }: { draw: { tool: PencilTool; ink: number; width: number }; setDraw: (p: Partial<{ tool: PencilTool; ink: number; width: number }>) => void }) {
  return (
    <PencilToolbar className="bottom-[78px]">
      <ToolPicker value={draw.tool} onChange={(tool) => setDraw({ tool })} />
      <PencilToolbarDivider />
      <InkPicker value={draw.ink} onChange={(ink) => setDraw({ ink })} inks={PK_INKS} />
      <PencilToolbarDivider />
      <WidthPicker value={draw.width} onChange={(width) => setDraw({ width })} widths={PK_W} />
    </PencilToolbar>
  );
}

/** What a stroke draws with, from the palette's settings. The two neutral inks follow the theme. */
export function drawSettings(d: { tool: PencilTool; ink: number; width: number }, autoInk: string): DrawSettings {
  return { tool: d.tool, ink: d.ink < 2 ? autoInk : PK_INKS[d.ink], width: PK_W[d.width].m };
}

/* ── Zoom ── */

export function ZoomCluster({ camera, onZoom, onFit, onActual }: { camera: Camera; onZoom: (factor: number) => void; onFit: () => void; onActual: () => void }) {
  return (
    <div data-slot="freeform-zoom" onPointerDown={(e) => e.stopPropagation()} className={cn('absolute right-3.5 bottom-3.5 flex items-center gap-0.5 p-1', cardClass)}>
      <ToolButton icon="minus" label="Zoom out (⌘−)" onPress={() => onZoom(0.8)} />
      <PlainButton aria-label="Actual size" title="Actual size (⌘1)" onPress={onActual} className="h-[34px] min-w-[52px] cursor-pointer rounded-[9px] border-0 bg-transparent px-1 text-footnote font-semibold text-muted-foreground tabular-nums hover:bg-secondary">
        {Math.round(camera.z * 100)}%
      </PlainButton>
      <ToolButton icon="plus" label="Zoom in (⌘+)" onPress={() => onZoom(1.25)} />
      <PencilToolbarDivider className="mx-0.5 my-1.5" />
      <ToolButton icon="arrows-expand" label="Fit to screen (⌘0)" onPress={onFit} />
    </div>
  );
}

/* ── Over a selection ── */

export function SelectionBar({ camera, size, onEdit }: { camera: Camera; size: { width: number; height: number }; onEdit: () => void }) {
  const f = useFreeform();
  const { selected, selection, byId } = f;
  const rect = unionRect(selected.map((i) => boundsOf(i, byId)));
  if (!rect || !selected.length) return null;
  const tl = toScreen(camera, { x: rect.x, y: rect.y });
  const br = toScreen(camera, { x: rect.x + rect.w, y: rect.y + rect.h });
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
      {editable ? <ToolButton icon="textformat" label="Edit text" onPress={onEdit} /> : null}
      <ToolButton icon="copy" label="Duplicate (⌘D)" onPress={() => f.duplicate(selection)} />
      <DropdownMenu>
        <ToolButton icon="layers" label="Arrange" />
        <DropdownMenuContent aria-label="Arrange" placement="bottom" onAction={(k) => f.arrange(selection, k as 'front' | 'back' | 'forward' | 'backward')}>
          <DropdownMenuItem id="front" className="min-h-10 py-2">Bring to Front</DropdownMenuItem>
          <DropdownMenuItem id="forward" className="min-h-10 py-2">Bring Forward</DropdownMenuItem>
          <DropdownMenuItem id="backward" className="min-h-10 py-2">Send Backward</DropdownMenuItem>
          <DropdownMenuItem id="back" className="min-h-10 py-2">Send to Back</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton icon={locked ? 'lock-fill' : 'lock-open'} label={locked ? 'Unlock' : 'Lock'} active={locked} onPress={() => f.setLocked(selection, !locked)} />
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <ToolButton icon="trash-slim" label="Delete" onPress={() => f.remove(selection)} />
    </div>
  );
}

