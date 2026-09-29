/* The launcher's shared state: the clipboard history, calculator history, Trash, appearance, the power overlay,
   workflow drafts, and the "Copied" HUD — one context, so any page can act on it. */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Haptics, toastApi, type ToastApi, type ToastQueue } from '@brett_lamy/ui';
import { CLIPS, REPOS, TRASH, type Clip } from './data';

export type PowerState = 'lock' | 'sleep' | 'restart' | 'off' | null;
export interface CalcEntry { expr: string; result: string }
export interface IssueDraft { repo?: string; title?: string; label?: string }
export interface RunningTimer { minutes: number; name: string; startedAt: number }

export interface Alfred {
  dark: boolean;
  toggleDark: () => void;
  /** The dark "Copied" pill. */
  hud: (title: string, icon?: string) => void;
  /** Writes to the system clipboard (when allowed), shows the HUD, and records it in the clipboard history. */
  copy: (text: string, hud?: string, from?: string) => void;
  clips: Clip[];
  removeClip: (id: string) => void;
  togglePin: (id: string) => void;
  history: CalcEntry[];
  addHistory: (e: CalcEntry) => void;
  trash: number;
  emptyTrash: () => void;
  power: PowerState;
  setPower: (p: PowerState) => void;
  issue: IssueDraft;
  setIssue: (patch: IssueDraft) => void;
  timer: RunningTimer | null;
  /** The timer workflow's chosen length, between its two pages. */
  timerDraft: number;
  setTimerDraft: (minutes: number) => void;
  startTimer: (minutes: number, name: string) => void;
  /** Back to the root page with an empty query (the menu's reset()). */
  reset: () => void;
  /** Hides the launcher. */
  close: () => void;
}

const Ctx = createContext<Alfred | null>(null);

export function useAlfred(): Alfred {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAlfred must be used inside <AlfredProvider>');
  return a;
}

const INITIAL_HISTORY: CalcEntry[] = [
  { expr: '1,280 × 1.0875', result: '1392' },
  { expr: '64 ÷ 3', result: '21.3333333333' },
  { expr: '2^16', result: '65536' },
];

export function AlfredProvider({ queue, dark, toggleDark, reset, close, children }: {
  queue: ToastQueue; dark: boolean; toggleDark: () => void; reset: () => void; close: () => void; children: ReactNode;
}) {
  const toast: ToastApi = useMemo(() => toastApi(queue), [queue]);
  const [clips, setClips] = useState(CLIPS);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [trash, setTrash] = useState(TRASH.items);
  const [power, setPower] = useState<PowerState>(null);
  // The last-used repository, so a story (or a reader) can open the workflow mid-way.
  const [issue, setIssueState] = useState<IssueDraft>({ repo: REPOS[0].name });
  const [timer, setTimer] = useState<RunningTimer | null>(null);
  const [timerDraft, setTimerDraft] = useState(25);

  const value: Alfred = {
    dark,
    toggleDark,
    hud: (title, icon) => { toast.hud(title, { tone: 'success', ...(icon ? { icon } : null) }); },
    copy: (text, hud = 'Copied to Clipboard', from = 'Alfred') => {
      try { void navigator.clipboard?.writeText(text).catch(() => undefined); } catch { /* not allowed here — the HUD still confirms */ }
      Haptics.notification('success');
      toast.hud(hud, { tone: 'success', haptic: 'none' });
      setClips((cs) => {
        const existing = cs.find((c) => c.text === text);
        if (existing?.pinned) return cs;
        const rest = cs.filter((c) => c.text !== text);
        const kind = /^https?:\/\//.test(text) ? 'link' : /^#[0-9a-f]{6}$/i.test(text) ? 'color' : 'text';
        // Copying something already in the history moves it to the top (same id, so its row keeps its place in React).
        const clip: Clip = existing ? { ...existing, when: 'Just now' } : { id: `c-new-${cs.length}-${text.length}`, kind, text, app: from, when: 'Just now' };
        return [...rest.filter((c) => c.pinned), clip, ...rest.filter((c) => !c.pinned)];
      });
    },
    clips,
    removeClip: (id) => setClips((cs) => cs.filter((c) => c.id !== id)),
    togglePin: (id) => setClips((cs) => {
      const c = cs.find((x) => x.id === id);
      if (!c) return cs;
      const next = { ...c, pinned: !c.pinned, when: c.pinned ? c.when.replace(/^Pinned /, '') : `Pinned ${c.when === 'Just now' ? 'today' : c.when}` };
      const rest = cs.filter((x) => x.id !== id);
      return next.pinned ? [next, ...rest] : [...rest.filter((x) => x.pinned), next, ...rest.filter((x) => !x.pinned)];
    }),
    history,
    addHistory: (entry) => setHistory((h) => [entry, ...h.filter((x) => x.expr !== entry.expr)].slice(0, 8)),
    trash,
    emptyTrash: () => setTrash(0),
    power,
    setPower,
    issue,
    setIssue: (patch) => setIssueState((d) => ({ ...d, ...patch })),
    timer,
    timerDraft,
    setTimerDraft,
    startTimer: (minutes, name) => setTimer({ minutes, name, startedAt: Date.now() }),
    reset,
    close,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
