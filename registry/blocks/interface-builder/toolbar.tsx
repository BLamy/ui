/* The window toolbar, Xcode's: the navigator toggle, Run and Stop, the device every scene is laid out for, the
   activity pill (the document, its scenes and segues, and its issues), then motion (play the selected scene's
   appear, the timeline), the scenes' appearance, undo and redo, the library (⇧⌘L), zoom and the inspector toggle. */
import { useEffect, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { diagnose } from './diagnostics';
import { LibraryList } from './library';
import { DEVICES, type DeviceId } from './model';
import { setDevice } from './ops';
import { useBuilder } from './store';

export function ToolButton({ icon, label, onPress, active, disabled, children, className }: {
  icon?: string; label: string; onPress?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <PlainButton
      aria-label={label}
      title={label}
      onPress={onPress}
      isDisabled={disabled}
      aria-pressed={active}
      className={cn(
        'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 px-1.5 text-muted-foreground outline-none',
        'hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-35',
        active && 'bg-secondary text-primary',
        className,
      )}
    >
      {children ?? <Icon name={icon} size={18} sw={1.9} />}
    </PlainButton>
  );
}

export interface ToolbarProps {
  navOpen: boolean;
  onToggleNav: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  sceneLook: 'light' | 'dark';
  onSceneLook: (l: 'light' | 'dark') => void;
  timelineOpen: boolean;
  onToggleTimeline: () => void;
  onPlay: () => void;
  zoom: number;
  onZoom: (k: number | 'fit') => void;
  compact: boolean;
}

export function Toolbar(p: ToolbarProps) {
  const b = useBuilder();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const issues = diagnose(b.doc);

  // ⇧⌘L opens the library, as in Xcode.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); setLibraryOpen((o) => !o); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const device = DEVICES[b.doc.device];
  return (
    <header data-slot="ib-toolbar" className="flex h-toolbar shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <ToolButton icon="sidebar-left" label={p.navOpen ? 'Hide Navigator' : 'Show Navigator'} onPress={p.onToggleNav} active={p.navOpen} />
      {p.running ? (
        <PlainButton aria-label="Stop" title="Stop (⌘.)" onPress={p.onStop} className="ml-1 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name="stop" size={14} sw={2} />
        </PlainButton>
      ) : (
        <PlainButton aria-label="Run" title="Run (⌘R)" onPress={p.onRun} className="ml-1 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-primary text-primary-foreground outline-none transition-transform duration-spring-snappy ease-spring-snappy hover:scale-105 data-pressed:scale-95 data-focus-visible:ring-2 data-focus-visible:ring-ring motion-reduce:transition-none">
          <Icon name="play" size={15} sw={2} />
        </PlainButton>
      )}
      <DropdownMenu>
        <PlainButton aria-label={`Device: ${device.name}`} className="ml-1 flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-footnote font-medium text-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name={b.doc.device === 'desktop' ? 'laptop' : 'iphone'} size={16} sw={1.9} className="text-muted-foreground" />
          {p.compact ? null : <span className="truncate">{device.name}</span>}
          <Icon name="chevron-up-down" size={12} sw={2.2} className="text-muted-foreground" />
        </PlainButton>
        <DropdownMenuContent aria-label="Device" onAction={(k) => b.commit((d) => setDevice(d, String(k) as DeviceId))}>
          {(Object.keys(DEVICES) as DeviceId[]).map((id) => (
            <DropdownMenuItem key={id} id={id} description={`${DEVICES[id].w} × ${DEVICES[id].h}`}>{DEVICES[id].name}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-w-0 flex-1 justify-center px-2">
        <div className="flex h-8 max-w-[440px] min-w-0 items-center gap-2 rounded-lg bg-secondary px-3 text-footnote text-muted-foreground">
          <Icon name="doc" size={14} sw={1.9} className="shrink-0" />
          <span className="truncate font-medium text-foreground">{b.doc.name}</span>
          {p.compact ? null : (
            <span className="truncate">
              {p.running ? `Running on ${device.name}` : `${b.doc.scenes.length} scenes · ${b.doc.segues.length} segues`}
            </span>
          )}
          <IssuesButton issues={issues} />
        </div>
      </div>

      {p.compact ? null : (
        <>
          <ToolButton icon="sparkle" label="Play the scene’s appear animations" onPress={p.onPlay} />
          <ToolButton icon="waveform" label={p.timelineOpen ? 'Hide Timeline' : 'Show Timeline'} onPress={p.onToggleTimeline} active={p.timelineOpen} />
          <ToolButton
            icon={p.sceneLook === 'dark' ? 'moon-fill' : 'sun'}
            label={`Scenes: ${p.sceneLook === 'dark' ? 'Dark' : 'Light'} (switch)`}
            onPress={() => p.onSceneLook(p.sceneLook === 'dark' ? 'light' : 'dark')}
          />
          <span className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}
      <ToolButton icon="arrow-uturn-backward" label="Undo (⌘Z)" onPress={b.undo} disabled={!b.canUndo} />
      <ToolButton icon="arrow-uturn-forward" label="Redo (⇧⌘Z)" onPress={b.redo} disabled={!b.canRedo} />
      <PopoverTrigger isOpen={libraryOpen} onOpenChange={setLibraryOpen}>
        <ToolButton icon="plus" label="Library (⇧⌘L)" active={libraryOpen} />
        <PopoverContent placement="bottom end" aria-label="Library" className="flex h-[min(520px,70vh)] w-[340px] flex-col p-0 [&>[data-slot=popover-content]]:flex [&>[data-slot=popover-content]]:min-h-0 [&>[data-slot=popover-content]]:flex-1 [&>[data-slot=popover-content]]:flex-col [&>[data-slot=popover-content]]:p-0">
          <LibraryList autoFocus className="flex-1" onDragStart={() => setLibraryOpen(false)} onInserted={() => setLibraryOpen(false)} />
        </PopoverContent>
      </PopoverTrigger>
      <DropdownMenu>
        <PlainButton aria-label="Zoom" title="Zoom" className="h-8 w-14 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent text-footnote font-medium text-muted-foreground tabular-nums outline-none hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring">
          {Math.round(p.zoom * 100)}%
        </PlainButton>
        <DropdownMenuContent aria-label="Zoom" placement="bottom end" onAction={(k) => p.onZoom(k === 'fit' ? 'fit' : k === 'in' ? 1.25 : k === 'out' ? 0.8 : 1 / p.zoom)}>
          <DropdownMenuItem id="in" shortcut="⌘+">Zoom In</DropdownMenuItem>
          <DropdownMenuItem id="out" shortcut="⌘−">Zoom Out</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem id="fit" shortcut="⌘0">Zoom to Fit</DropdownMenuItem>
          <DropdownMenuItem id="actual" shortcut="⌘1">Actual Size</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton icon="sidebar-right" label={p.inspectorOpen ? 'Hide Inspector' : 'Show Inspector'} onPress={p.onToggleInspector} active={p.inspectorOpen} />
    </header>
  );
}

function IssuesButton({ issues }: { issues: ReturnType<typeof diagnose> }) {
  const b = useBuilder();
  if (!issues.length) return <Icon name="check-circle-fill" size={14} sw={1.9} className="shrink-0 text-success" title="No issues" aria-label="No issues" />;
  return (
    <PopoverTrigger>
      <PlainButton aria-label={`${issues.length} issue${issues.length === 1 ? '' : 's'}`} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1 font-semibold text-warning outline-none hover:bg-background data-focus-visible:ring-2 data-focus-visible:ring-ring">
        <Icon name="warning-fill" size={13} sw={1.9} />{issues.length}
      </PlainButton>
      <PopoverContent placement="bottom" aria-label="Issues" className="w-[360px] p-0">
        {({ close }) => (
          <ul className="m-0 flex max-h-[360px] list-none flex-col overflow-y-auto p-1.5">
            {issues.map((i, k) => (
              <li key={k}>
                <PlainButton
                  onPress={() => { b.select(i.select); close(); }}
                  className="flex w-full cursor-pointer items-start gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring"
                >
                  <Icon name={i.level === 'error' ? 'xmark-circle-fill' : 'warning-fill'} size={15} sw={1.9} className={cn('mt-0.5 shrink-0', i.level === 'error' ? 'text-destructive' : 'text-warning')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-footnote text-foreground">{i.message}</span>
                    <span className="truncate text-caption2 text-muted-foreground">{i.where}</span>
                  </span>
                </PlainButton>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </PopoverTrigger>
  );
}
