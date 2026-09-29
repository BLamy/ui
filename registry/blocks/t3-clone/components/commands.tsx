import { useEffect, useRef, useState } from 'react';
import { matchesHotkey, useWorkbenchShell, type Appearance } from '@brett_lamy/ui';
import { CommandPalette } from './command-palette';
import { ThemeEditor } from './theme-editor';
import { threadUuid, type Project } from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

export interface PaletteState {
  open: boolean;
  /** Pages to open on. */
  pages?: string[];
  /** Bumped on every open, so the palette remounts fresh (root page, empty query). */
  key: number;
}

export interface CommandsProps {
  palette: PaletteState;
  onPalette: (next: PaletteState | ((s: PaletteState) => PaletteState)) => void;
  threads: ThreadsState;
  project: string;
  projects: Project[];
  onNewThread: (project: string) => void;
  onAddProject: (project: Project) => void;
  onOpenFile: (path: string) => void;
  onAppearance: (a: Appearance) => void;
  tint: string;
  onTint: (t: string) => void;
  notify: (message: string) => void;
}

/**
 * The palette, the theme editor, and the block's keyboard shortcuts. Shortcuts listen on the document but only
 * act for this block: when focus is inside it, or nothing is focused and the pointer is over it — so a page
 * hosting several blocks (the docs) doesn't open them all.
 */
export function Commands(props: CommandsProps) {
  const { palette, onPalette, threads, notify } = props;
  const shell = useWorkbenchShell();
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState(false);
  const [links, setLinks] = useState<Record<string, number[]>>({});
  const linked = threads.current ? (links[threads.current.id] ?? []) : [];

  const open = (pages?: string[]) => onPalette((s) => ({ open: true, pages, key: s.key + 1 }));
  const copyId = () => {
    if (!threads.current) return;
    void navigator.clipboard?.writeText(threadUuid(threads.current.id)).catch(() => {});
    notify('Copied thread ID');
  };

  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    const root = layer?.parentElement;
    if (!root) return;
    const active = document.activeElement;
    const mine = (active && active !== document.body && root.contains(active)) || ((!active || active === document.body) && root.matches(':hover'));
    if (!mine) return;
    const run = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (matchesHotkey(e, 'mod+k')) return run(() => (palette.open ? onPalette((s) => ({ ...s, open: false })) : open()));
    if (matchesHotkey(e, 'shift+mod+o')) return run(() => { onPalette((s) => ({ ...s, open: false })); props.onNewThread(props.project); });
    if (matchesHotkey(e, 'shift+mod+c')) return run(copyId);
    if (matchesHotkey(e, 'mod+p')) return run(() => open(['files']));
    if (matchesHotkey(e, 'shift+mod+f')) return run(() => open(['search']));
    if (matchesHotkey(e, 'alt+shift+mod+t')) return run(() => setEditor((v) => !v));
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => !e.defaultPrevented && keys.current(e);
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, []);

  return (
    <>
      {/* The palette portals here: inside the shell's theme scope, and its scrim covers just the block. */}
      <div ref={setLayer} className="contents" />
      <ThemeEditor
        open={editor}
        onClose={() => setEditor(false)}
        appearance={shell.appearance}
        onAppearance={props.onAppearance}
        tint={props.tint}
        onTint={props.onTint}
      />
      <CommandPalette
        key={palette.key}
        open={palette.open}
        onOpenChange={(o) => onPalette((s) => ({ ...s, open: o }))}
        pages={palette.pages}
        container={layer}
        threads={threads}
        project={props.project}
        projects={props.projects}
        onNewThread={props.onNewThread}
        onAddProject={props.onAddProject}
        linked={linked}
        onLink={(n) => threads.current && setLinks((l) => ({ ...l, [threads.current!.id]: [...(l[threads.current!.id] ?? []), n] }))}
        onOpenFile={(path) => {
          props.onOpenFile(path);
          shell.setPanelOpen(true);
        }}
        onToggleThemeEditor={() => setEditor((v) => !v)}
        notify={notify}
      />
    </>
  );
}
