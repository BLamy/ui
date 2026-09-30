/* The block's state, shared through context: which project and tab are open, what the detail stack should push
   next, the bugs (their status and severity change), the runs (a live one ticks forward), the Ask QA thread
   (replies stream in), the palette and the dialogs. Pages read it with useLoopQA() — the detail stack keeps
   pushed pages as elements, so they must read live data from here rather than from props captured at push time. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type SplitViewState } from '@/components/ui/split-view';
import { createToastQueue, toastApi, type ToastApi } from '@/components/ui/toast';
import { useReducedMotion } from '@/lib/motion';
import { type Appearance } from '@/lib/theme';
import { chunks, replyTo, SEED_CHAT, isOpen, type ChatMessage } from './agent';
import {
  BUGS, LIVE_PLAN, NOW, PROJECTS, RUNS, bugReport, type Bug, type BugStatus, type Project, type Run, type Severity,
} from './data';

export type ProjectTab = 'overview' | 'bugs' | 'sitemap' | 'runs' | 'tests';
export type PushTarget = { kind: 'bug' | 'run' | 'test'; id: string };
export type DialogName = 'share' | 'settings' | 'tracker' | 'new-project' | null;

export interface PaletteState {
  open: boolean;
  pages?: string[];
  /** Bumped on every open, so the palette remounts fresh. */
  key: number;
}

export interface LoopQAOptions {
  appearance?: Appearance;
  project?: string | null;
  tab?: ProjectTab;
  push?: PushTarget | null;
  askOpen?: boolean;
  palette?: boolean | string[];
  /** Show a run in progress, frozen after this many journeys (stories). */
  liveRunAt?: number;
  /** Start with an empty Ask QA thread. */
  emptyChat?: boolean;
  /** Floating Ask QA starts with its transcript open (default: `askOpen`). */
  chatExpanded?: boolean;
}

export function useLoopQAState(o: LoopQAOptions) {
  const reduced = useReducedMotion();
  const [look, setLook] = useState<Appearance | undefined>(o.appearance);
  const [section, setSection] = useState<string>(o.project ?? 'projects');
  const [tabs, setTabs] = useState<Record<string, ProjectTab>>(() => (o.project && o.tab ? { [o.project]: o.tab } : {}));
  const [pending, setPending] = useState<(PushTarget & { section: string }) | null>(() =>
    o.push ? { ...o.push, section: o.project ?? projectOf(o.push) ?? 'projects' } : null);
  const [bugs, setBugs] = useState<Bug[]>(BUGS);
  const [runs, setRuns] = useState<Run[]>(() => (o.liveRunAt != null ? [liveRun(o.liveRunAt), ...RUNS] : RUNS));
  // Ask QA opens by default only where it can dock beside the page (see `wide`); the toggle then decides. Closed,
  // it is folded into its FAB. Where it floats, `chatOpen` is its whole transcript grown over the page (the toggle
  // opens it that far; dragged down, it rests as the composer with the newest reply peeking).
  const [askPref, setAskPref] = useState<boolean | null>(o.askOpen ?? null);
  const [wide, setWide] = useState(true);
  const askOpen = askPref ?? wide;
  const [chatOpen, setChatOpen] = useState(o.chatExpanded ?? !!o.askOpen);
  const setAskOpen = useCallback((v: boolean) => {
    setAskPref(v);
    setChatOpen(v && !wide);
  }, [wide]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => (o.emptyChat ? [] : SEED_CHAT));
  const [streaming, setStreaming] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteState>(() => ({ open: !!o.palette, pages: Array.isArray(o.palette) ? o.palette : undefined, key: 0 }));
  const [dialog, setDialog] = useState<DialogName>(null);
  const [trackers, setTrackers] = useState<string[]>([]);
  const [currentBug, setCurrentBug] = useState<string | null>(null);
  const [hud] = useState(createToastQueue);
  const toast = useMemo<ToastApi>(() => toastApi(hud), [hud]);

  const project = PROJECTS.find((p) => p.id === section) ?? null;
  const tab: ProjectTab = (project && tabs[project.id]) || 'overview';

  /* ── navigation ── */
  /** The SplitView's API (registered from inside it), so programmatic navigation pushes columns on a phone. */
  const split = useRef<SplitViewState | null>(null);
  const openSection = useCallback((id: string) => {
    if (split.current) split.current.select('sidebar', id);
    else setSection(id);
  }, []);
  const setTab = useCallback((t: ProjectTab) => setTabs((m) => (section ? { ...m, [section]: t } : m)), [section]);
  /** Select the target's project and push its page on the detail stack (the stack bridge consumes it). */
  const open = useCallback((target: PushTarget) => {
    const s = projectOf(target, bugs, runs) ?? section;
    setPending({ ...target, section: s });
    if (s !== section || split.current?.collapsed) openSection(s);
  }, [bugs, openSection, runs, section]);
  const consumePending = useCallback(() => setPending(null), []);

  /* ── bugs ── */
  const setBugStatus = useCallback((id: string, status: BugStatus) => setBugs((l) => l.map((b) => (b.id === id ? { ...b, status } : b))), []);
  const setBugSeverity = useCallback((id: string, severity: Severity) => setBugs((l) => l.map((b) => (b.id === id ? { ...b, severity } : b))), []);
  const copy = useCallback((text: string, message: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    toast.hud(message, { tone: 'success' });
  }, [toast]);
  const copyBugReport = useCallback((id: string) => {
    const b = bugs.find((x) => x.id === id);
    if (b) copy(bugReport(b, PROJECTS.find((p) => p.id === b.projectId)), `Copied ${b.id}`);
  }, [bugs, copy]);
  const copyBugReports = useCallback((projectId: string) => {
    const list = bugs.filter((b) => b.projectId === projectId && isOpen(b));
    const p = PROJECTS.find((x) => x.id === projectId);
    copy(list.map((b) => bugReport(b, p)).join('\n\n---\n\n'), `Copied ${list.length} bug report${list.length === 1 ? '' : 's'}`);
  }, [bugs, copy]);
  const connectTracker = useCallback((id: string, name: string) => {
    setTrackers((t) => (t.includes(id) ? t : [...t, id]));
    toast.success(`${name} connected`, { description: 'New bugs will be filed automatically.' });
  }, [toast]);

  /* ── runs ── */
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  /** Runs started here are numbered on from the sample data's last (#2419). */
  const nextRunId = `run-${2420 + runs.filter((r) => Number(r.id.slice(4)) >= 2420).length}`;
  const startRun = useCallback((projectId: string, trigger: Run['trigger'] = 'Manual', id = nextRunId) => {
    if (runs.some((r) => r.status === 'running')) { toast.warning('A run is already in progress'); return id; }
    const p = PROJECTS.find((x) => x.id === projectId) ?? PROJECTS[0]!;
    setRuns((l) => [{ ...liveRun(0, p), id, trigger }, ...l]);
    toast(`Run started on ${p.name}`, { description: `${LIVE_PLAN.length} journeys planned` });
    let step = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      step += 1;
      setRuns((l) => l.map((r) => (r.id === id ? advance(r, step) : r)));
      if (step >= LIVE_PLAN.length) {
        clearInterval(timer.current!);
        timer.current = null;
        toast.success(`Run completed on ${p.name}`, { description: '8 journeys · 2 bugs rediscovered' });
      }
    }, reduced ? 400 : 1300);
    return id;
  }, [nextRunId, reduced, runs, toast]);

  /* ── Ask QA ── */
  const stream = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (stream.current) clearInterval(stream.current); }, []);
  const stopStreaming = useCallback(() => {
    if (stream.current) clearInterval(stream.current);
    stream.current = null;
    setStreaming(null);
  }, []);
  const send = useCallback((text: string) => {
    const p = project ?? PROJECTS[0]!;
    const seq = messages.length;
    const reply = replyTo(text, p, bugs, nextRunId);
    const id = `a${seq + 2}`;
    setMessages((m) => [...m, { id: `u${seq + 1}`, role: 'user', text }, { id, role: 'assistant', text: '', tools: reply.tools, worked: reply.worked }]);
    setStreaming(id);
    const parts = chunks(reply.text);
    let i = 0;
    const finish = () => {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: reply.text, runId: reply.runId } : x)));
      stopStreaming();
      if (reply.runId) startRun(p.id, 'Ask QA', reply.runId);
    };
    if (reduced) { finish(); return; }
    if (stream.current) clearInterval(stream.current);
    // A beat of "thinking" before the first token, then a few words every 45ms.
    let wait = 6;
    stream.current = setInterval(() => {
      if (wait-- > 0) return;
      i += 1;
      if (i >= parts.length) { finish(); return; }
      const shown = parts.slice(0, i).join('');
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: shown } : x)));
    }, 45);
  }, [bugs, messages.length, nextRunId, project, reduced, startRun, stopStreaming]);
  const newChat = useCallback(() => { stopStreaming(); setMessages([]); }, [stopStreaming]);

  const openPalette = useCallback((pages?: string[]) => setPalette((s) => ({ open: true, pages, key: s.key + 1 })), []);

  return {
    look, setLook, section, setSection, openSection, split, wide, setWide, project, tab, setTab, pending, open, consumePending,
    bugs, setBugStatus, setBugSeverity, copyBugReport, copyBugReports, copy,
    runs, startRun, nextRunId, trackers, connectTracker,
    askOpen, setAskOpen, setAskPref, chatOpen, setChatOpen, messages, streaming, send, stopStreaming, newChat,
    palette, setPalette, openPalette, dialog, setDialog, currentBug, setCurrentBug, toast, hud,
  };
}

export type LoopQA = ReturnType<typeof useLoopQAState>;

const Ctx = createContext<LoopQA | null>(null);
export function LoopQAProvider({ value, children }: { value: LoopQA; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLoopQA(): LoopQA {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLoopQA must be used inside the Loop QA block');
  return v;
}

/* ── helpers ── */

function projectOf(t: PushTarget, bugs: Bug[] = BUGS, runs: Run[] = RUNS): string | null {
  if (t.kind === 'bug') return bugs.find((b) => b.id === t.id)?.projectId ?? null;
  if (t.kind === 'run') return runs.find((r) => r.id === t.id)?.projectId ?? null;
  return 'northwind';
}

/** A run of LIVE_PLAN with `done` journeys finished. */
function liveRun(done: number, p: Project = PROJECTS[0]!): Run {
  const base: Run = {
    id: 'run-2420', projectId: p.id, title: 'Checkout, cart and promo flows', status: 'running',
    started: new Date(NOW - done * 50_000).toISOString(), duration: 0, trigger: 'Ask QA', environment: 'Production',
    journeys: [], plannedJourneys: LIVE_PLAN.length, newBugs: 0, rediscovered: 0, coverage: 0,
  };
  return done ? advance(base, done) : base;
}

function advance(r: Run, done: number): Run {
  const journeys = LIVE_PLAN.slice(0, done).map((j, i) => ({ id: `lj${i}`, title: j.title, status: j.status, steps: j.steps, bugIds: j.bugIds ?? [] }));
  const finished = done >= LIVE_PLAN.length;
  return {
    ...r, journeys, status: finished ? 'completed' : 'running', duration: Math.max(1, Math.round(done * 4.5)),
    rediscovered: journeys.filter((j) => j.bugIds.length).length, coverage: Math.round((done / LIVE_PLAN.length) * 76),
  };
}
