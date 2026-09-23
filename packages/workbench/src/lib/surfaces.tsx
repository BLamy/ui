import * as React from 'react';
import { ToggleButtonGroup } from 'react-aria-components';
import { Button, ToggleButton } from './press';
import { MultiFileDiff } from '@pierre/diffs/react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { cn } from './util';
import { vib, tick } from './haptics';
import { WIcon, IconBtn, type WIconName } from './icons';
import { TermBody } from './terminal';
import { useWorkbenchAppearance } from './theme';

/* ══ Surfaces (right panel) ══ */
export type SurfaceKind = 'browser' | 'terminal' | 'files' | 'diff' | 'agents';
export interface SurfaceMeta {
  k: SurfaceKind;
  icon: WIconName;
  name: string;
  blurb: string;
}
export const SURFACES: SurfaceMeta[] = [
  { k: 'browser', icon: 'globe', name: 'Browser', blurb: 'Open a local app or URL.' },
  { k: 'terminal', icon: 'term', name: 'Terminal', blurb: 'Start a shell in this workspace.' },
  { k: 'files', icon: 'files', name: 'Files', blurb: 'Browse and read workspace files.' },
  { k: 'diff', icon: 'diff', name: 'Diff', blurb: 'Review changes in this thread.' },
  { k: 'agents', icon: 'bot', name: 'Agents', blurb: 'Watch subagents and workflows run.' },
];

export function SurfaceEmpty({ onOpen, className }: { onOpen: (k: SurfaceKind) => void; className?: string }) {
  return (
    <div
      data-slot="surface-empty"
      className={cn('wb-scroll flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-[26px]', className)}
    >
      <div className="mb-5 text-center">
        <div className="text-[16.5px] font-[650]">Open a surface</div>
        <div className="mt-[3px] text-[12.5px] text-wb-label2">Choose what to show in the right panel.</div>
      </div>
      <div className="mx-auto grid w-full max-w-[420px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {SURFACES.map((s) => (
          <Button
            key={s.k}
            data-slot="surface-card"
            className="wb-btn wb-hl cursor-pointer rounded-[13px] border border-wb-sep bg-wb-card px-3.5 py-[15px] text-left text-wb-label"
            onPress={() => {
              vib([8]);
              onOpen(s.k);
            }}
          >
            <WIcon name={s.icon} size={21} sw={1.6} className="text-wb-label2" />
            <div className="mt-2.5 text-[13.5px] font-[650]">{s.name}</div>
            <div className="mt-[3px] text-[11.5px] leading-[1.45] text-wb-label2">{s.blurb}</div>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SurfaceBrowser({ className }: { className?: string }) {
  return (
    <div data-slot="surface-browser" className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-wb-sep px-2.5 py-[7px]">
        <WIcon name="chevR" size={14} sw={2} className="-scale-x-100 text-wb-label3" />
        <WIcon name="chevR" size={14} sw={2} className="text-wb-label3 opacity-40" />
        <div className="flex flex-1 items-center gap-1.5 rounded-[7px] bg-wb-fill px-[9px] py-1 font-mono text-[12px] text-wb-label2">
          <span className="size-1.5 rounded-[50%] bg-wb-green" />
          http://localhost:3000
        </div>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center bg-wb-well p-5">
        <div className="text-center">
          <span className="inline-grid size-10 place-items-center rounded-[10px] bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
            <WIcon name="spark" size={20} sw={2} className="text-white" />
          </span>
          <div className="mt-3 text-[13.5px] font-[650]">app-builder</div>
          <div className="mt-[3px] font-mono text-[12px] text-wb-label3">serving on :3000 · pid 5229</div>
          <div className="mt-4 flex justify-center gap-1.5">
            {['w-[52px]', 'w-[76px]', 'w-[40px]'].map((w, i) => (
              <span key={i} className={cn('h-2 rounded-sm bg-wb-fill2', w)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FILE_PATHS = [
  'cookbook/src/components/Credenza.tsx',
  'cookbook/src/components/SideDrawer.tsx',
  'cookbook/src/components/MessageScroller.tsx',
  'cookbook/src/haptics.ts',
  'cookbook/src/App.tsx',
  'cookbook/blui.jsx',
  'cookbook/workbench.jsx',
  'cookbook/package.json',
  'cookbook/vite.config.js',
];
/* @pierre/trees reads its colors from these custom properties on the tree host. */
const TREE_VARS = {
  '--trees-fg-override': 'var(--wb-label)',
  '--trees-border-color-override': 'var(--wb-sep)',
  '--trees-selected-bg-override': 'var(--wb-fill2)',
} as React.CSSProperties;
export function SurfaceFiles({ className }: { className?: string }) {
  const { model } = useFileTree({
    paths: FILE_PATHS,
    initialExpansion: 'open',
    initialSelectedPaths: ['cookbook/src/App.tsx'],
    onSelectionChange: () => tick(),
    search: true,
  });
  return (
    <div data-slot="surface-files" data-renderer="pierre-trees" className={cn('min-h-0 flex-1 px-2.5 py-2', className)}>
      <FileTree model={model} header={<strong className="text-[12.5px]">Project files</strong>} className="h-full min-h-[220px]" style={TREE_VARS} />
    </div>
  );
}

const OLD_HAPTICS = `export async function bootHaptics() {
  if (navigator.vibrate) return
  await import('https://esm.run/ios-vibrator-pro-max')
}`;
const NEW_HAPTICS = `export async function bootHaptics() {
  if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate
  await import('https://esm.sh/ios-vibrator-pro-max@3.0.3')
  window.addEventListener('bl-vib', reportHaptic)
}`;
const surfaceDiffOptions = {
  diffStyle: 'unified' as const,
  diffIndicators: 'bars' as const,
  hunkSeparators: 'line-info' as const,
  overflow: 'scroll' as const,
};
export function SurfaceDiff({ className }: { className?: string }) {
  const appearance = useWorkbenchAppearance();
  const options = React.useMemo(() => ({ ...surfaceDiffOptions, themeType: appearance }), [appearance]);
  return (
    <div data-slot="surface-diff" data-renderer="pierre-diffs" className={cn('wb-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2.5', className)}>
      <div className="overflow-hidden rounded-[9px] border border-wb-sep">
        <MultiFileDiff
          oldFile={{ name: 'src/haptics.ts', contents: OLD_HAPTICS }}
          newFile={{ name: 'src/haptics.ts', contents: NEW_HAPTICS }}
          options={options}
        />
      </div>
    </div>
  );
}

const AGENTS = [
  { n: 'docs-writer', s: 'running', m: 'writing message-scroller.md · 2m 14s' },
  { n: 'test-runner', s: 'passed', m: '42 passed · 0 failed · 18s' },
  { n: 'lint', s: 'passed', m: 'no issues · 4s' },
  { n: 'bundle-size', s: 'queued', m: 'waiting on test-runner' },
];
/* status → dot background / label color */
const AGENT_DOT: Record<string, string> = { running: 'bg-wb-tint animate-[wbPulse_1.2s_infinite]', passed: 'bg-wb-green' };
const AGENT_TEXT: Record<string, string> = { running: 'text-wb-tint', passed: 'text-wb-green' };
export function SurfaceAgents({ className }: { className?: string }) {
  return (
    <div data-slot="surface-agents" className={cn('wb-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2.5', className)}>
      {AGENTS.map((a) => (
        <div key={a.n} className="mb-1 flex items-center gap-2.5 rounded-[10px] border border-wb-sep bg-wb-card px-2.5 py-[9px]">
          <span className={cn('size-2 shrink-0 rounded-[50%]', AGENT_DOT[a.s] ?? 'bg-wb-label3')} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12.5px] font-[650]">{a.n}</div>
            <div className="mt-px text-[11.5px] text-wb-label2">{a.m}</div>
          </div>
          <span className={cn('text-[10.5px] font-bold tracking-[.5px] uppercase', AGENT_TEXT[a.s] ?? 'text-wb-label3')}>{a.s}</span>
        </div>
      ))}
    </div>
  );
}

export interface SurfacePanelProps {
  kind?: SurfaceKind | null;
  onOpen: (k: SurfaceKind | null) => void;
  onClose?: () => void;
  full?: boolean;
  onFull?: (f: boolean) => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function SurfacePanel({ kind, onOpen, onClose, full, onFull, compact, className, style }: SurfacePanelProps) {
  const meta = SURFACES.find((s) => s.k === kind);
  return (
    <div data-slot="surface-panel" className={cn('box-border flex h-full w-full flex-col bg-wb-side', className)} style={style}>
      <div className="box-border flex min-h-10 shrink-0 items-center gap-0.5 border-b border-wb-sep py-1.5 pr-2 pl-3.5">
        {meta ? <WIcon name={meta.icon} size={15} sw={1.8} className="text-wb-label2" /> : null}
        <span className={cn('text-[13px] font-[650]', meta && 'ml-1.5')}>{meta ? meta.name : 'Surfaces'}</span>
        <span className="flex-1" />
        {meta ? (
          <IconBtn
            name="chevD"
            label="Switch surface"
            size={15}
            onPress={() => {
              tick();
              onOpen(null);
            }}
          />
        ) : null}
        {!compact ? (
          <IconBtn
            name={full ? 'restore' : 'expand'}
            label={full ? 'Exit full screen' : 'Full screen'}
            size={16}
            onPress={() => {
              vib([8]);
              if (onFull) onFull(!full);
            }}
            active={full}
          />
        ) : null}
        <IconBtn name="x" label="Close panel" size={16} onPress={onClose} />
      </div>
      {kind === 'browser' ? (
        <SurfaceBrowser />
      ) : kind === 'terminal' ? (
        <div className="wb-term flex min-h-0 flex-1 flex-col bg-wb-term">
          <TermBody />
        </div>
      ) : kind === 'files' ? (
        <SurfaceFiles />
      ) : kind === 'diff' ? (
        <SurfaceDiff />
      ) : kind === 'agents' ? (
        <SurfaceAgents />
      ) : (
        <SurfaceEmpty onOpen={onOpen} />
      )}
    </div>
  );
}

export interface SurfaceTabBarProps {
  active: string;
  onPick: (k: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
/** Compact-width surface switcher: a single-select react-aria ToggleButtonGroup (arrow keys move focus).
    Every press reports through `onPick`, including a press on the current surface. */
export function SurfaceTabBar({ active, onPick, className, style }: SurfaceTabBarProps) {
  const tabs = [{ k: 'chat', icon: 'msg' as WIconName, name: 'Chat' }, ...SURFACES.map((s) => ({ k: s.k as string, icon: s.icon, name: s.name }))];
  return (
    <ToggleButtonGroup
      data-slot="surface-tab-bar"
      aria-label="Surfaces"
      selectionMode="single"
      selectedKeys={active ? [active] : []}
      className={cn('flex shrink-0 border-t border-wb-sep bg-wb-side', className)}
      style={style}
    >
      {tabs.map((t) => (
        <ToggleButton
          key={t.k}
          id={t.k}
          className="wb-btn flex min-h-[50px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent pt-[7px] pb-1.5 text-wb-label3 data-selected:text-wb-tint"
          onPress={() => onPick(t.k)}
        >
          <WIcon name={t.icon} size={20} sw={1.8} />
          <span className="text-[9.5px] font-semibold tracking-[.2px]">{t.name}</span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
