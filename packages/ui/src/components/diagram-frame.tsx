'use client';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEventHandler, type ReactNode, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SideDrawer } from '@/components/ui/side-drawer';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';

/* ══ DiagramFrame — a board with a panel beside it, or under it ══
   The panel is a column beside the board when there's the room, and a tray under it when there isn't, which is closed to begin
   with. The tray's a Credenza, but it's modal only to the space it's in, so the board isn't covered or dimmed: you can watch it,
   and press on it, while the panel's open. Either way there's a bar to open the panel again. */

/** The panel goes beside the board at this width or more, and in a tray under it below that. */
export const PANEL_BESIDE_FROM = 560;
const PANEL_WIDTH = 280;
/** How much of the height a tray takes, up to a limit, and how much of that isn't its contents: its margins and its header. */
const TRAY_SHARE = 0.58;
const TRAY_MOST = 480;
const TRAY_CHROME = 70;

export interface DiagramFrameProps {
  /** The root's ref and size, from `useContainerSize`, as a layout usually wants them as well. */
  host: RefObject<HTMLDivElement | null>;
  size: { width: number; height: number };
  title: string;
  /** What's in the panel, or nothing for no panel at all. */
  panel?: ReactNode;
  /** What the bar says while the panel's closed. */
  status?: ReactNode;
  /** Whether the panel starts open. By default it does if it fits beside the board, and it doesn't if it'd go over it. */
  defaultOpen?: boolean;
  /** What takes focus when the panel opens beside the board, in the panel. By default, its first button. */
  focusSelector?: string;
  /** The root's `data-slot`, for a part made of this. */
  slot?: string;
  onBoardKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  /** Something to show over all of it, like what's inside what's selected. The board stays as it is underneath, and out of reach. */
  cover?: ReactNode;
  /** The board, given the bar to put in its `overlay`. */
  children: (bar: ReactNode) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function DiagramFrame({ host, size, title, panel, status, defaultOpen, focusSelector = 'button', slot = 'diagram-frame', onBoardKeyDown, cover, children, className, style }: DiagramFrameProps) {
  const beside = size.width >= PANEL_BESIDE_FROM;
  const [choice, setChoice] = useState<boolean | null>(defaultOpen ?? null);
  const open = choice ?? beside;
  const panelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // Beside the board, the panel and the button that opens it take each other's place, so focus has to go from one to the other.
  // A tray does this itself, so the button stays there for it to come back to.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current || !beside) return;
    moved.current = false;
    if (open) panelRef.current?.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    else barRef.current?.querySelector('button')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, beside]);
  const choose = (next: boolean) => {
    moved.current = true;
    setChoice(next);
  };
  const trayHeight = Math.round(Math.min(size.height * TRAY_SHARE, TRAY_MOST));
  const bar = panel && (!open || !beside) ? (
    <div ref={barRef} data-slot="diagram-frame-bar" className={cn('absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-ctl bg-popover p-2 pl-3 text-footnote text-foreground shadow-hairline', open && 'pointer-events-none opacity-0')}>
      <span className="min-w-0 truncate font-semibold">{status}</span>
      <Button data-slot="diagram-frame-open" variant="secondary" size="sm" onPress={() => choose(true)}>{title}</Button>
    </div>
  ) : null;
  return (
    <div ref={host} data-slot={slot} className={cn('absolute inset-0 flex overflow-hidden', !beside && 'flex-col', className)} style={style}>
      <div className="relative min-h-0 min-w-0 flex-1" inert={!!cover || undefined} onKeyDown={onBoardKeyDown}>{children(bar)}</div>
      {panel && beside && open ? <div ref={panelRef} className="contents" inert={!!cover || undefined}><SideDrawer mode="fixed" open onClose={() => choose(false)} title={title} width={PANEL_WIDTH}>{panel}</SideDrawer></div> : null}
      {panel && !beside && !cover ? (
        // A tray's modal to what it's in. That's only this, under the board, which isn't covered or dimmed, as it's what you're watching.
        <div data-slot="diagram-frame-tray-host" className="relative shrink-0 bg-background [&>div:first-child]:bg-transparent" style={{ height: open ? trayHeight : 0 }}>
          <Credenza compact open={open} onClose={() => choose(false)} title={title} className="top-2.5">
            <div data-slot="diagram-frame-tray" className="bl-scroll touch-pan-y overflow-y-auto" style={{ height: trayHeight - TRAY_CHROME }}>{panel}</div>
          </Credenza>
        </div>
      ) : null}
      {cover ? <div data-slot="diagram-frame-cover" className="absolute inset-0 z-10 flex flex-col bg-background">{cover}</div> : null}
    </div>
  );
}

/** A titled part of a panel. */
export function DiagramPanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-slot="diagram-panel-section" aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="m-0 text-footnote font-semibold text-foreground/70">{title}</h3>
      {children}
    </section>
  );
}

/** A field that changes something when you've finished with it: on Enter, or on leaving it. Escape puts it back. */
export function DiagramPanelField({ label, value, slot, placeholder, onCommit }: { label: string; value: string; slot: string; placeholder?: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => {
    if (draft === value) return;
    onCommit(draft);
    // If it's refused, the value hasn't changed, so this is what puts it back.
    setDraft(value);
  };
  return (
    <TextField data-slot={slot} value={draft} onChange={setDraft} onBlur={commit} onKeyDown={(e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { setDraft(value); e.stopPropagation(); }
    }}>
      <Label variant="field">{label}</Label>
      <Input size="sm" placeholder={placeholder} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
    </TextField>
  );
}
