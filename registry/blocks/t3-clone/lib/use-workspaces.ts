import { useState } from 'react';
import type { SurfaceKind, TermLine } from '@brett_lamy/ui';
import { WORKSPACES, blankTerminal, blankWorkspace, type ThreadWorkspace } from './data';

/** Where a thread that doesn't exist yet keeps its terminals and panel. */
export const DRAFT = 'draft';

/**
 * What each thread has open beside it — its terminals (with scrollback), the surface in the right panel and the
 * file selected in it. Everything is keyed by thread, so picking another thread brings back its own terminals
 * and panel, and going back finds them as you left them. The draft (no thread yet) is one more key: `adopt`
 * hands it to the thread the first message creates.
 */
export function useWorkspaces(initialSurface?: SurfaceKind | null) {
  const [spaces, setSpaces] = useState<Record<string, ThreadWorkspace>>(() =>
    initialSurface === undefined ? WORKSPACES : { ...WORKSPACES, t1: { ...WORKSPACES.t1, surface: initialSurface } },
  );
  const patch = (key: string, fn: (w: ThreadWorkspace) => ThreadWorkspace) =>
    setSpaces((all) => ({ ...all, [key]: fn(all[key] ?? blankWorkspace()) }));

  /** The workspace of one thread, with the actions that change it. */
  const of = (key: string) => {
    const workspace = spaces[key] ?? blankWorkspace();
    const active = workspace.terminals.find((t) => t.id === workspace.terminal) ?? workspace.terminals[0];
    return {
      ...workspace,
      /** the terminal showing */
      active,
      setSurface: (surface: SurfaceKind | null) => patch(key, (w) => ({ ...w, surface })),
      setFile: (file: string) => patch(key, (w) => ({ ...w, file })),
      selectTerminal: (terminal: string) => patch(key, (w) => ({ ...w, terminal })),
      setLines: (id: string, lines: TermLine[]) => patch(key, (w) => ({ ...w, terminals: w.terminals.map((t) => (t.id === id ? { ...t, lines } : t)) })),
      newTerminal: () =>
        patch(key, (w) => {
          const id = `${key}-term-${Date.now()}`;
          return { ...w, terminals: [...w.terminals, blankTerminal(id, `zsh ${w.terminals.length + 1}`)], terminal: id };
        }),
      closeTerminal: (id: string) =>
        patch(key, (w) => {
          if (w.terminals.length === 1) return w;
          const at = w.terminals.findIndex((t) => t.id === id);
          const terminals = w.terminals.filter((t) => t.id !== id);
          return { ...w, terminals, terminal: w.terminal === id ? terminals[Math.max(0, at - 1)].id : w.terminal };
        }),
    };
  };

  /** The draft becomes `key` (a thread was just created from it) and the draft starts over. */
  const adopt = (key: string) =>
    setSpaces((all) => {
      const { [DRAFT]: draft, ...rest } = all;
      return draft ? { ...rest, [key]: draft } : rest;
    });

  /** A fresh draft: whatever the last unsent one had open is dropped. */
  const resetDraft = () =>
    setSpaces((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== DRAFT)));

  return { of, adopt, resetDraft };
}
export type Workspace = ReturnType<ReturnType<typeof useWorkspaces>['of']>;
