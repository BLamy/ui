/* The window toolbar, Xcode's: the navigator toggle, Run and Stop, the device every scene is laid out for, the
   activity pill (the document, its scenes and segues, and its issues), then motion (play the selected scene's
   appear, the timeline), the scenes' appearance, undo and redo, the library (⇧⌘L), zoom and the inspector toggle. */
import { useRef, useState, type ReactNode } from 'react';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlainButton, PlainToggleButton } from '@/components/ui/plain-button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSizeClass } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { diagnose } from './diagnostics';
import { LibraryList } from './library';
import { DEVICES, type DeviceId } from './model';
import { setDevice } from './ops';
import { useBuilder } from './store';

/** The look of a toolbar button, for a trigger part that renders as one. */
export const toolButtonClass = (active?: boolean, className?: string) => cn(
  'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 px-1.5 text-muted-foreground outline-none',
  'hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-35',
  'data-pressed:bg-secondary data-pressed:text-primary',
  active && 'bg-secondary text-primary',
  className,
);

export function ToolButton({ icon, label, onClick, disabled, children, className }: {
  icon?: string; label: string; onClick?: () => void; disabled?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <PlainButton aria-label={label} title={label} onClick={onClick} disabled={disabled} className={toolButtonClass(false, className)}>
      {children ?? <Icon name={icon} size={18} sw={1.9} />}
    </PlainButton>
  );
}

/** A toolbar button that shows something while it's on (a pane, the timeline): a toggle with `aria-pressed`. */
export function ToolToggle({ icon, label, pressed, onPressedChange }: { icon: string; label: string; pressed: boolean; onPressedChange: (pressed: boolean) => void }) {
  return (
    <PlainToggleButton aria-label={label} title={label} pressed={pressed} onPressedChange={onPressedChange} className={toolButtonClass()}>
      <Icon name={icon} size={18} sw={1.9} />
    </PlainToggleButton>
  );
}

export interface ToolbarProps {
  navOpen: boolean;
  onToggleNav: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  running: boolean;
  onRun: (event: Event) => void;
  onStop: (event: Event) => void;
  sceneLook: 'light' | 'dark';
  onSceneLook: (l: 'light' | 'dark') => void;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
  onPlay: () => void;
  zoom: number;
  onZoom: (k: number | 'fit') => void;
}

export function Toolbar(p: ToolbarProps) {
  const b = useBuilder();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const issues = diagnose(b.doc);
  // The builder's size class: compact drops the labels and the motion tools.
  const [, sizeClass] = useSizeClass();
  const compact = sizeClass === 'compact';
  const bar = useRef<HTMLElement>(null);

  // ⇧⌘L opens the library, as in Xcode, while focus is in this builder.
  useShortcut('mod+shift+l', () => setLibraryOpen((o) => !o), {
    when: () => !!bar.current?.closest('[data-slot=interface-builder]')?.contains(document.activeElement),
    description: 'Library',
  });

  const device = DEVICES[b.doc.device];
  return (
    <header ref={bar} data-slot="ib-toolbar" className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <ToolToggle icon="sidebar-left" label="Navigator" pressed={p.navOpen} onPressedChange={p.onToggleNav} />
      {/* One button that runs and stops, so focus comes back to it when the preview closes. */}
      <PlainButton
        aria-label={p.running ? 'Stop' : 'Run'}
        title={p.running ? 'Stop (⌘.)' : 'Run (⌘R)'}
        onClick={(e) => (p.running ? p.onStop(e.nativeEvent) : p.onRun(e.nativeEvent))}
        className={cn(
          'ml-1 grid size-8 cursor-pointer place-items-center rounded-full border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          p.running
            ? 'bg-secondary text-foreground hover:bg-secondary-strong'
            : 'bg-primary text-primary-foreground transition-transform duration-spring-snappy ease-spring-snappy hover:scale-105 active:scale-95 motion-reduce:transition-none',
        )}
      >
        {p.running ? <Icon name="stop" size={14} sw={2} /> : <Icon name="play" size={15} sw={2} />}
      </PlainButton>
      <DropdownMenu onAction={(id) => b.commit((d) => setDevice(d, id as DeviceId))}>
        <DropdownMenuTrigger aria-label={`Device: ${device.name}`} className="ml-1 flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-footnote font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
          <Icon name={b.doc.device === 'desktop' ? 'laptop' : 'iphone'} size={16} sw={1.9} className="text-muted-foreground" />
          {compact ? null : <span className="truncate">{device.name}</span>}
          <Icon name="chevron-up-down" size={12} sw={2.2} className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(Object.keys(DEVICES) as DeviceId[]).map((id) => (
            <DropdownMenuItem key={id} value={id} description={`${DEVICES[id].w} × ${DEVICES[id].h}`}>{DEVICES[id].name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-w-0 flex-1 justify-center px-2">
        <div className="flex h-8 max-w-[440px] min-w-0 items-center gap-2 rounded-lg bg-secondary px-3 text-footnote text-muted-foreground">
          <Icon name="doc" size={14} sw={1.9} className="shrink-0" />
          <span className="truncate font-medium text-foreground">{b.doc.name}</span>
          {compact ? null : (
            <span className="truncate">
              {p.running ? `Running on ${device.name}` : `${b.doc.scenes.length} scenes · ${b.doc.segues.length} segues`}
            </span>
          )}
          <IssuesButton issues={issues} />
        </div>
      </div>

      {compact ? null : (
        <>
          <ToolButton icon="sparkle" label="Play the scene’s appear animations" onClick={p.onPlay} />
          <ToolToggle icon="waveform" label="Timeline" pressed={p.timelineOpen} onPressedChange={p.onToggleTimeline} />
          <ToolButton
            icon={p.sceneLook === 'dark' ? 'moon-fill' : 'sun'}
            label={`Scenes: ${p.sceneLook === 'dark' ? 'Dark' : 'Light'} (switch)`}
            onClick={() => p.onSceneLook(p.sceneLook === 'dark' ? 'light' : 'dark')}
          />
          <span className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}
      <ToolButton icon="arrow-uturn-backward" label="Undo (⌘Z)" onClick={b.undo} disabled={!b.canUndo} />
      <ToolButton icon="arrow-uturn-forward" label="Redo (⇧⌘Z)" onClick={b.redo} disabled={!b.canRedo} />
      <Popover open={libraryOpen} onOpenChange={setLibraryOpen}>
        <PopoverTrigger aria-label="Library (⇧⌘L)" title="Library (⇧⌘L)" className={toolButtonClass(libraryOpen)}>
          <Icon name="plus" size={18} sw={1.9} />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="flex h-[min(520px,70vh)] w-[340px] flex-col p-0">
          <LibraryList autoFocus className="flex-1" onDragStart={() => setLibraryOpen(false)} onInserted={() => setLibraryOpen(false)} />
        </PopoverContent>
      </Popover>
      <DropdownMenu onAction={(k) => p.onZoom(k === 'fit' ? 'fit' : k === 'in' ? 1.25 : k === 'out' ? 0.8 : 1 / p.zoom)}>
        <DropdownMenuTrigger aria-label="Zoom" title="Zoom" className="h-8 w-14 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent text-footnote font-medium text-muted-foreground tabular-nums outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {Math.round(p.zoom * 100)}%
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem value="in" shortcut="mod+=">Zoom In</DropdownMenuItem>
          <DropdownMenuItem value="out" shortcut="mod+-">Zoom Out</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="fit" shortcut="mod+0">Zoom to Fit</DropdownMenuItem>
          <DropdownMenuItem value="actual" shortcut="mod+1">Actual Size</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolToggle icon="sidebar-right" label="Inspector" pressed={p.inspectorOpen} onPressedChange={p.onToggleInspector} />
    </header>
  );
}

function IssuesButton({ issues }: { issues: ReturnType<typeof diagnose> }) {
  const b = useBuilder();
  if (!issues.length) return <Icon name="check-circle-fill" size={14} sw={1.9} className="shrink-0 text-success" title="No issues" aria-label="No issues" />;
  return (
    <Popover>
      <PopoverTrigger aria-label={`${issues.length} issue${issues.length === 1 ? '' : 's'}`} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1 font-semibold text-warning outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring">
        <Icon name="warning-fill" size={13} sw={1.9} />{issues.length}
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-[360px] p-0">
        <ul className="m-0 flex max-h-[360px] list-none flex-col overflow-y-auto p-1.5">
          {issues.map((i, k) => (
            <li key={k}>
              <PopoverClose
                onClick={() => b.select(i.select)}
                className="flex w-full cursor-pointer items-start gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name={i.level === 'error' ? 'xmark-circle-fill' : 'warning-fill'} size={15} sw={1.9} className={cn('mt-0.5 shrink-0', i.level === 'error' ? 'text-destructive' : 'text-warning')} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-footnote text-foreground">{i.message}</span>
                  <span className="truncate text-caption2 text-muted-foreground">{i.where}</span>
                </span>
              </PopoverClose>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
