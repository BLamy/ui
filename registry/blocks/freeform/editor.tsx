/* An open board: the canvas with its chrome — a header (back, title, undo and redo, Format, more), the insert bar,
   the drawing palette, zoom and the bar over a selection. It owns what the canvas and the chrome share: the camera,
   the active tool, the drawing settings, and which item's text is being edited. */
import { useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { PencilTool } from '@/components/ui/pencilkit/constants';
import { PlainButton } from '@/components/ui/plain-button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContainerSize } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { fitCamera, toBoard, zoomAt } from './camera';
import { Canvas, type Tool } from './canvas';
import { boundsOf, unionRect } from './geometry';
import { FormatPanel } from './inspector';
import { makeImage, makeLink, makeShape, makeSticky, makeText, type Camera, type ShapeKind } from './model';
import { AUTO_INK, SHAPE_FILLS } from './palette';
import { useFreeform } from './store';
import { DrawBar, InsertBar, SelectionBar, ToolButton, ZoomCluster, drawSettings, type Inserts } from './toolbar';

export function BoardEditor({ compact, onBack }: { compact: boolean; onBack: () => void }) {
  const f = useFreeform();
  const { board, items, byId } = f;
  const [vref, size] = useContainerSize<HTMLDivElement>({ width: 900, height: 600 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  const [tool, setTool] = useState<Tool>('select');
  const [draw, setDrawState] = useState<{ tool: PencilTool; ink: number; width: number }>({ tool: 'pen', ink: 0, width: 1 });
  const [editing, setEditing] = useState<string | null>(null);
  const inserted = useRef(0);

  // Open with the whole board in view.
  useLayoutEffect(() => {
    const r = vref.current?.getBoundingClientRect();
    if (!r) return;
    setCamera(fitCamera(unionRect(items.map((i) => boundsOf(i, byId))), { width: r.width, height: r.height }));
    // Once, when the board opens (the editor remounts per board).
  }, []);

  if (!board) return null;

  const fit = () => setCamera(fitCamera(unionRect(items.map((i) => boundsOf(i, byId))), size));
  const zoom = (k: number) => setCamera((c) => zoomAt(c, k, size.width / 2, size.height / 2));

  /* ── Inserting ── */
  // New things land in the middle of the view, each a little off the last so they don't stack exactly.
  const spot = (w: number, h: number, at?: { x: number; y: number }) => {
    const c = at ?? toBoard(camera, size.width / 2, size.height / 2);
    const off = (inserted.current++ % 6) * 22;
    return { x: Math.round(c.x - w / 2 + (at ? 0 : off)), y: Math.round(c.y - h / 2 + (at ? 0 : off)) };
  };
  const addFile = (file: File, at?: { x: number; y: number }) => {
    const src = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const w = Math.min(360, img.naturalWidth || 360);
      const h = Math.round((w * (img.naturalHeight || 240)) / (img.naturalWidth || 360));
      const p = spot(w, h, at);
      f.add([{ ...makeImage(p.x, p.y, 0), src, w, h }]);
      setTool('select');
    };
    img.src = src;
  };
  const inserts: Inserts = {
    sticky: (color) => {
      const p = spot(168, 168);
      const s = makeSticky(p.x, p.y, color);
      f.add([s]);
      setTool('select');
      // After the menu has closed and handed focus back to its button, or the note would lose its caret at once.
      window.setTimeout(() => setEditing(s.id), 260);
    },
    shape: (kind: ShapeKind) => {
      const probe = makeShape(0, 0, kind);
      const p = spot(probe.w, probe.h);
      f.add([makeShape(p.x, p.y, kind, SHAPE_FILLS[inserted.current % SHAPE_FILLS.length])]);
      setTool('select');
    },
    text: () => {
      const p = spot(260, 40);
      const t = makeText(p.x, p.y, '', 32);
      f.add([t]);
      setTool('select');
      setEditing(t.id);
    },
    art: (i) => { const p = spot(260, 190); f.add([makeImage(p.x, p.y, i)]); setTool('select'); },
    file: (file) => addFile(file),
    link: (url, title) => { const p = spot(280, 84); f.add([makeLink(p.x, p.y, url, title)]); setTool('select'); },
  };

  const onDrop = (e: DragEvent) => {
    const files = [...e.dataTransfer.files].filter((x) => x.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const r = vref.current?.getBoundingClientRect();
    const at = toBoard(camera, e.clientX - (r?.left ?? 0), e.clientY - (r?.top ?? 0));
    files.forEach((file, n) => addFile(file, { x: at.x + n * 24, y: at.y + n * 24 }));
  };

  return (
    <div data-slot="freeform-editor" className="absolute inset-0 flex animate-bl-fade-in flex-col bg-background">
      <header className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border bg-card px-2.5">
        <PlainButton aria-label="Boards" onPress={onBack} className="flex h-9 cursor-pointer items-center gap-0.5 rounded-lg border-0 bg-transparent pr-2 pl-1 text-detail font-medium text-primary hover:bg-secondary">
          <Icon name="chevron-left" size={22} sw={2.2} />
          {compact ? null : 'Boards'}
        </PlainButton>
        <div className="flex min-w-0 flex-1 justify-center">
          <TitleField key={board.id + board.title} title={board.title} onCommit={(t) => f.renameBoard(board.id, t)} />
        </div>
        <ToolButton icon="arrow-uturn-backward" label="Undo (⌘Z)" onPress={f.undo} />
        <ToolButton icon="arrow-uturn-forward" label="Redo (⇧⌘Z)" onPress={f.redo} />
        <PopoverTrigger>
          <ToolButton icon="sliders" label="Format" />
          <PopoverContent placement="bottom end" aria-label="Format" className="w-[300px]"><FormatPanel /></PopoverContent>
        </PopoverTrigger>
        <DropdownMenu>
          <ToolButton icon="ellipsis" label="More" />
          <DropdownMenuContent
            aria-label="Board"
            placement="bottom end"
            onAction={(k) => {
              if (k === 'fit') fit();
              else if (k === 'actual') setCamera((c) => zoomAt(c, 1 / c.z, size.width / 2, size.height / 2));
              else if (k === 'duplicate') { f.duplicateBoard(board.id); onBack(); }
              else if (k === 'delete') { f.deleteBoard(board.id); onBack(); }
            }}
          >
            <DropdownMenuItem id="fit" className="min-h-10 py-2">Zoom to Fit</DropdownMenuItem>
            <DropdownMenuItem id="actual" className="min-h-10 py-2">Actual Size</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem id="duplicate" className="min-h-10 py-2">Duplicate Board</DropdownMenuItem>
            <DropdownMenuItem id="delete" variant="destructive" className="min-h-10 py-2">Delete Board</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div ref={vref} className="relative min-h-0 flex-1" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={onDrop}>
        <Canvas size={size} camera={camera} setCamera={(fn) => setCamera(fn)} tool={tool} setTool={setTool} draw={drawSettings(draw, AUTO_INK)} editing={editing} setEditing={setEditing} />
        {tool === 'select' && !editing && f.selection.length ? (
          <SelectionBar camera={camera} size={size} onEdit={() => { f.begin(); setEditing(f.selection[0]); }} />
        ) : null}
        {tool === 'draw' ? <DrawBar draw={draw} setDraw={(p) => setDrawState((d) => ({ ...d, ...p }))} /> : null}
        <InsertBar tool={tool} setTool={setTool} inserts={inserts} />
        {compact ? null : <ZoomCluster camera={camera} onZoom={zoom} onFit={fit} onActual={() => setCamera((c) => zoomAt(c, 1 / c.z, size.width / 2, size.height / 2))} />}
      </div>
    </div>
  );
}

/** The board's title, edited in place. */
function TitleField({ title, onCommit }: { title: string; onCommit: (t: string) => void }) {
  const [v, setV] = useState(title);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setV(title); e.currentTarget.blur(); } }}
      aria-label="Board title"
      size={Math.max(6, v.length + 1)}
      className={cn('h-9 max-w-full min-w-0 rounded-lg border-0 bg-transparent px-2 text-center text-detail font-semibold text-foreground outline-none select-text hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-primary')}
    />
  );
}
