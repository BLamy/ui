/* The open repository, for every screen, and the hooks that talk to it. useLoad asks the source for one thing and keeps
   it current: a write anywhere invalidates what it touched (github-api.ts) and every mounted load re-reads, keeping what
   it has on screen until the new answer arrives, so changes appear without a reload or a flash. <Failed> explains a
   failure in GitHub's terms with the remedy that fits; <ActionError> does the same for a write that didn't take. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { KeychainSignIn } from '../apple-passwords/page';
import type { Repo, User } from './data';
import { dataRevision, GitHubError, type GitHub } from './github-api';
import type { Route } from './route';
import type { Maybe, RepoSource } from './source';
import { Box, Oct, ghButton, type OctName, type Layout } from './parts';

export interface Nav {
  /** Goes to a screen in this repository. */
  go: (r: Route, o?: { replace?: boolean }) => void;
  back: () => void;
  /** github.com's URL for a screen here. */
  url: (r: Route) => string;
  /** Follows a link: a GitHub URL opens in the block, anything else in a new tab. */
  open: (href: string) => void;
  /** Whether a link would stay in the block. */
  isInternal: (href: string) => boolean;
  /** Switches to another repository (optionally on a given screen). */
  openRepo: (full: string, r?: Route) => void;
  clone: () => void;
  /** Opens the search palette (optionally with a query). */
  search: (q?: string) => void;
  goToFile: () => void;
}

export interface RepoState {
  source: RepoSource;
  /** The keychain's GitHub sign-in; null when the block runs without the keychain. */
  keychain: KeychainSignIn | null;
  openPicker: () => void;
  /** Loaded metadata (screens under RepoScreens can rely on it). */
  repo?: Repo;
  viewer?: User | null;
  /** The ref being browsed; '' is the default branch. */
  ref: string;
  nav: Nav;
  ui: Layout;
  gh: GitHub | null;
  /** Short confirmations ("Copied", "Branch deleted"). */
  notify: (message: string) => void;
  /** Open the app menu (account, your work, notifications). */
  openApp: (view?: 'menu' | 'issues' | 'pulls' | 'notifications' | 'new-repo') => void;
}

const Ctx = createContext<RepoState | null>(null);
export const RepoProvider = Ctx.Provider;
export function useRepo(): RepoState & { repo: Repo } {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRepo needs RepoProvider');
  return v as RepoState & { repo: Repo };
}
export const useNav = () => useRepo().nav;

/** What the signed-in account may do in this repository: the one place screens ask. */
export function useCan() {
  const { repo, viewer, source } = useRepo();
  const p = repo.permissions;
  const open = !repo.archived;
  return {
    signedIn: !!viewer,
    triage: open && p.triage,
    push: open && p.push,
    admin: p.admin,
    /** Anyone signed in, unless the repository is read-only. */
    participate: open && !!viewer,
    author: (login?: string) => !!viewer && viewer.login === login,
    /** Why a control is off, in a sentence, or null. */
    readOnlyReason: repo.archived ? 'This repository is archived and read-only.' : !viewer ? (source.live ? 'Sign in to do this.' : null) : null,
  };
}

export interface Load<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
  /** Ask again (a failed request isn't cached). */
  retry: () => void;
}

/* Last answers by key, so a screen you come back to draws at once and then checks. Keys include the source's id, which
   names the client, so nothing crosses accounts. */
const lastAnswers = new Map<string, unknown>();

/** One answer from the source, keyed by `key` (include the source id and arguments). */
export function useLoad<T>(key: string, load: () => Maybe<T>): Load<T> {
  const revision = useSyncExternalStore(dataRevision.subscribe, dataRevision.get, dataRevision.get);
  const [tick, setTick] = useState(0);
  const id = `${key}#${tick}#${revision}`;
  // Asked once per `id` (it names the request); `load` is a fresh closure every render.
  const asked = useMemo((): { value?: Maybe<T>; error?: unknown } => { try { return { value: load() }; } catch (error) { return { error }; } }, [id]);
  const [done, setDone] = useState<{ id: string; key: string; data?: T; error?: unknown } | null>(null);
  useEffect(() => {
    const v = asked.value;
    if (!(v instanceof Promise)) return;
    let on = true;
    v.then(
      (data) => { if (on) { lastAnswers.set(key, data); setDone({ id, key, data }); } },
      (error: unknown) => { if (on) setDone({ id, key, error }); },
    );
    return () => { on = false; };
  }, [asked, id, key]);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  if ('error' in asked) return { error: asked.error, loading: false, retry };
  if (!(asked.value instanceof Promise)) return { data: asked.value as T, loading: false, retry };
  if (done?.id === id) return { data: done.data, error: done.error, loading: false, retry };
  // Still asking: keep what we have for this key on screen.
  if (done?.key === key && !done.error) return { data: done.data, loading: true, retry };
  if (lastAnswers.has(key)) return { data: lastAnswers.get(key) as T, loading: true, retry };
  return { loading: true, retry };
}

/** Draws `children(data)` once there's something to draw; <Pending> before, <Failed> on an error. */
export function Loaded<T>({ load, children, pending, className }: { load: Load<T>; children: (data: T) => ReactNode; pending?: ReactNode; className?: string }) {
  if (load.error) return <Failed error={load.error} retry={load.retry} className={className} />;
  if (load.loading && load.data === undefined) return <>{pending ?? <Pending className={className} />}</>;
  return <>{children(load.data as T)}</>;
}

/** A quiet delay before it shows: answers that are nearly instant never flash a spinner. */
export function Pending({ label = 'Loading from GitHub…', className }: { label?: string; className?: string }) {
  return (
    <Box className={cn('grid animate-[gh-fade-in_160ms_ease-out_200ms_both] place-items-center gap-3 px-6 py-12 text-center text-muted-foreground', className)}>
      <style>{'@keyframes gh-fade-in{from{opacity:0}to{opacity:1}}'}</style>
      <Spinner size={20} label={label} />
      <span className="text-caption">{label}</span>
    </Box>
  );
}

const FAILURE: Record<string, [OctName, string]> = {
  auth: ['lock', 'Sign in again'],
  forbidden: ['lock', 'You don’t have access to this'],
  notFound: ['eyeClosed', 'Not found'],
  rateLimit: ['history', 'Rate limited'],
  validation: ['x', 'GitHub couldn’t do that'],
  other: ['x', 'Something went wrong'],
};

/** What went wrong, in GitHub's terms, and what to do about it. `notFound` says what's missing; only a missing repository offers the picker. */
export function Failed({ error, retry, className, what }: { error: unknown; retry?: () => void; className?: string; what?: string }) {
  const { keychain, openPicker, repo } = useContext(Ctx) ?? {};
  const kind = error instanceof GitHubError ? error.kind : 'other';
  const [icon, title] = FAILURE[kind];
  const message = kind === 'notFound' && repo ? (what ?? 'That isn’t here: it may have been moved or deleted, or this sign-in can’t see it.') : error instanceof Error ? error.message : String(error);
  return (
    <Box className={cn('grid place-items-center px-6 py-12 text-center', className)}>
      <div role="alert" className="contents">
        <Oct name={icon} size={24} className="text-muted-foreground" />
        <h3 className="mt-3 mb-1 text-callout font-semibold">{title}</h3>
        <p className="m-0 max-w-[420px] text-detail text-muted-foreground">{message}</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {kind === 'auth' && keychain ? <Button className={ghButton(true)} onPress={keychain.signIn}>Sign in with GitHub</Button> : null}
        {kind === 'notFound' && openPicker && !repo ? <Button className={ghButton()} onPress={openPicker}>Choose a repository</Button> : null}
        {retry && kind !== 'auth' ? <Button className={ghButton()} onPress={retry}><Oct name="retry" />Try again</Button> : null}
      </div>
    </Box>
  );
}

/** A write that didn't take: GitHub's own words, in place, next to what you were doing. */
export function ActionError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p role="alert" className={cn('m-0 flex items-start gap-1.5 text-caption text-(--gh-closed)', className)}>
      <Oct name="x" size={14} className="mt-px shrink-0" /><span className="min-w-0">{message}</span>
    </p>
  );
}

/** Runs a write: `busy` while it's out, `error` if it fails; returns whether it worked. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (e) {
      if (alive.current) setError(e);
      return undefined;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);
  return { busy, error, run, clear: useCallback(() => setError(null), []) };
}

/** Asks `refresh` every `ms` while `active` and the page is visible: GitHub's slow answers (mergeability, running checks). */
export function usePoll(active: boolean, ms: number, refresh: () => void) {
  const fn = useRef(refresh);
  fn.current = refresh;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (!document.hidden) fn.current(); }, ms);
    return () => clearInterval(t);
  }, [active, ms]);
}
