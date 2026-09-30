import * as React from 'react';
import { MultiFileDiff } from '@pierre/diffs/react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { PlainButton as Button } from '@/components/ui/plain-button';
import { useWorkbenchAppearance } from '@/components/ui/workbench-theme';
import { Icon, type IconName } from '@/lib/icon';
import { cn, pressable, brandTile } from '@/lib/utils';


/* ══ Surfaces — what fills the WorkbenchPanel ══
   Each surface is a body that flexes to fill the panel under a WorkbenchPanelHeader. They take their data
   as props; `SurfacePicker` is the empty state that lists them. */

export type SurfaceKind = 'browser' | 'terminal' | 'files' | 'diff' | 'agents';
export interface SurfaceMeta {
  k: SurfaceKind;
  icon: IconName | (string & {});
  name: string;
  blurb: string;
}
export const SURFACES: SurfaceMeta[] = [
  { k: 'browser', icon: 'network', name: 'Browser', blurb: 'Open a local app or URL.' },
  { k: 'terminal', icon: 'terminal', name: 'Terminal', blurb: 'Start a shell in this workspace.' },
  { k: 'files', icon: 'square-on-square', name: 'Files', blurb: 'Browse and read workspace files.' },
  { k: 'diff', icon: 'doc-text', name: 'Diff', blurb: 'Review changes in this thread.' },
  { k: 'agents', icon: 'robot', name: 'Agents', blurb: 'Watch subagents and workflows run.' },
];

export interface SurfacePickerProps {
  onPick: (k: SurfaceKind) => void;
  surfaces?: SurfaceMeta[];
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}
/** A card grid of surfaces — the panel's empty state. */
export function SurfacePicker({
  onPick,
  surfaces = SURFACES,
  title = 'Open a surface',
  description = 'Choose what to show in the right panel.',
  className,
}: SurfacePickerProps) {
  return (
    <div data-slot="surface-picker" className={cn('wb-scroll flex min-h-0 flex-1 flex-col justify-center-safe overflow-y-auto px-5 py-[26px]', className)}>
      <div className="mb-5 text-center">
        <div className="text-[16.5px] font-[650]">{title}</div>
        <div className="mt-[3px] text-[12.5px] text-muted-foreground">{description}</div>
      </div>
      <div className="mx-auto grid w-full max-w-[420px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {surfaces.map((s) => (
          <Button
            key={s.k}
            data-slot="surface-card"
            className={cn(pressable, 'cursor-pointer rounded-[13px] border border-border bg-card px-3.5 py-[15px] text-left text-foreground hover:bg-secondary!')}
            onPress={() => {
              onPick(s.k);
            }}
          >
            <Icon name={s.icon} size={21} sw={1.6} className="text-muted-foreground" />
            <div className="mt-2.5 text-[13.5px] font-[650]">{s.name}</div>
            <div className="mt-[3px] text-[11.5px] leading-[1.45] text-muted-foreground">{s.blurb}</div>
          </Button>
        ))}
      </div>
    </div>
  );
}

export interface SurfaceBrowserProps {
  url: string;
  /** the page: an iframe, a screenshot, or a `SurfaceAppPreview` */
  children?: React.ReactNode;
  className?: string;
}
/** URL bar over a page well. */
export function SurfaceBrowser({ url, children, className }: SurfaceBrowserProps) {
  return (
    <div data-slot="surface-browser" className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2.5 py-[7px]">
        <Icon name="chevron-right-wide" size={14} sw={2} className="-scale-x-100 text-tertiary-foreground" />
        <Icon name="chevron-right-wide" size={14} sw={2} className="text-tertiary-foreground opacity-40" />
        <div className="flex flex-1 items-center gap-1.5 rounded-[7px] bg-secondary px-[9px] py-1 font-mono text-[12px] text-muted-foreground">
          <span className="size-1.5 rounded-[50%] bg-success" />
          {url}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center bg-muted p-5">{children}</div>
    </div>
  );
}
/** Placeholder page for a local app: tile, name, status line, skeleton bars. */
export function SurfaceAppPreview({ name, detail }: { name: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div data-slot="surface-app-preview" className="text-center">
      <span className={cn(brandTile, 'inline-grid size-10 place-items-center rounded-[10px]')}>
        <Icon name="asterisk" size={20} sw={2} className="text-white" />
      </span>
      <div className="mt-3 text-[13.5px] font-[650]">{name}</div>
      {detail != null ? <div className="mt-[3px] font-mono text-[12px] text-tertiary-foreground">{detail}</div> : null}
      <div className="mt-4 flex justify-center gap-1.5">
        {['w-[52px]', 'w-[76px]', 'w-[40px]'].map((w, i) => (
          <span key={i} className={cn('h-2 rounded-sm bg-secondary-strong', w)} />
        ))}
      </div>
    </div>
  );
}

/* @pierre/trees reads its colors from these custom properties on the tree host. */
const TREE_VARS = {
  '--trees-fg-override': 'var(--foreground)',
  '--trees-border-color-override': 'var(--border)',
  '--trees-selected-bg-override': 'var(--secondary-strong, var(--accent))',
} as React.CSSProperties;
export interface SurfaceFilesProps {
  paths: string[];
  selected?: string[];
  onSelect?: (paths: string[]) => void;
  title?: React.ReactNode;
  className?: string;
}
/** A @pierre/trees file tree in Workbench tokens. */
export function SurfaceFiles({ paths, selected, onSelect, title = 'Project files', className }: SurfaceFilesProps) {
  const { model } = useFileTree({
    paths,
    initialExpansion: 'open',
    initialSelectedPaths: selected,
    onSelectionChange: (p: readonly string[]) => {
      onSelect?.([...p]);
    },
    search: true,
  });
  return (
    <div data-slot="surface-files" data-renderer="pierre-trees" className={cn('min-h-0 flex-1 px-2.5 py-2', className)}>
      <FileTree model={model} header={<strong className="text-[12.5px]">{title}</strong>} className="h-full min-h-[220px]" style={TREE_VARS} />
    </div>
  );
}

export interface SurfaceDiffFile {
  name: string;
  contents: string;
}
const surfaceDiffOptions = {
  diffStyle: 'unified' as const,
  diffIndicators: 'bars' as const,
  hunkSeparators: 'line-info' as const,
  overflow: 'scroll' as const,
};
/** A @pierre/diffs unified diff, themed to the Workbench appearance. */
export function SurfaceDiff({ oldFile, newFile, className }: { oldFile: SurfaceDiffFile; newFile: SurfaceDiffFile; className?: string }) {
  const appearance = useWorkbenchAppearance();
  const options = React.useMemo(() => ({ ...surfaceDiffOptions, themeType: appearance }), [appearance]);
  return (
    <div data-slot="surface-diff" data-renderer="pierre-diffs" className={cn('wb-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2.5', className)}>
      <div className="overflow-hidden rounded-[9px] border border-border">
        <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
      </div>
    </div>
  );
}

export interface SurfaceAgent {
  name: string;
  status: 'running' | 'passed' | 'failed' | 'queued' | (string & {});
  detail?: string;
}
/* status → dot background / label color */
const AGENT_DOT: Record<string, string> = { running: 'bg-primary animate-[wbPulse_1.2s_infinite]', passed: 'bg-success', failed: 'bg-destructive' };
const AGENT_TEXT: Record<string, string> = { running: 'text-primary', passed: 'text-success', failed: 'text-destructive' };
/** Subagent / workflow runs with live status dots. */
export function SurfaceAgents({ agents, className }: { agents: SurfaceAgent[]; className?: string }) {
  return (
    <div data-slot="surface-agents" className={cn('wb-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2.5', className)}>
      {agents.map((a) => (
        <div key={a.name} className="mb-1 flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-[9px]">
          <span className={cn('size-2 shrink-0 rounded-[50%]', AGENT_DOT[a.status] ?? 'bg-tertiary-foreground')} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12.5px] font-[650]">{a.name}</div>
            {a.detail ? <div className="mt-px text-[11.5px] text-muted-foreground">{a.detail}</div> : null}
          </div>
          <span className={cn('text-[10.5px] font-bold tracking-[.5px] uppercase', AGENT_TEXT[a.status] ?? 'text-tertiary-foreground')}>{a.status}</span>
        </div>
      ))}
    </div>
  );
}

/** A terminal well for the panel (put a `TerminalBody` in it). */
export function SurfaceTerminal({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div data-slot="surface-terminal" data-theme-scope="terminal" className={cn('dark scheme-dark flex min-h-0 flex-1 flex-col bg-background text-foreground', className)}>{children}</div>;
}
