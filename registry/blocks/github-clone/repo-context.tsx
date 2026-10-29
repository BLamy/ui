/* The open repository, for every screen: which RepoSource answers (sample or live), the loaded metadata, the branch
   being browsed, the keychain's GitHub sign-in, and the repository picker. useLoad asks the source for one thing and
   tracks it — a sample answer is there on the first render, a live one shows <Pending> and then the data, a failure
   shows <Failed> explaining it (sign in again, not found, rate limit) with a way out. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { KeychainSignIn } from '../apple-passwords/page';
import type { Repo, User } from './data';
import { GitHubError } from './github-api';
import type { Maybe, RepoSource } from './source';
import { Box, Oct, ghButton, type OctName } from './parts';

export interface RepoState {
  source: RepoSource;
  /** The keychain's GitHub sign-in; null when the block runs without the keychain. */
  keychain: KeychainSignIn | null;
  openPicker: () => void;
  /** Loaded metadata (screens under RepoScreens can rely on it). */
  repo?: Repo;
  viewer?: User;
  /** The branch being browsed; '' is the default branch. */
  ref: string;
  setRef: (ref: string) => void;
}

const Ctx = createContext<RepoState | null>(null);
export const RepoProvider = Ctx.Provider;
export function useRepo(): RepoState & { repo: Repo } {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRepo needs RepoProvider');
  return v as RepoState & { repo: Repo };
}

export interface Load<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
  /** Ask again (a failed request isn't cached). */
  retry: () => void;
}

/** One answer from the source, keyed by `key` (include the source id and arguments). */
export function useLoad<T>(key: string, load: () => Maybe<T>): Load<T> {
  const [tick, setTick] = useState(0);
  const id = key + '#' + tick;
  // Asked once per `id` (it names the request); `load` is a fresh closure every render.
  const asked = useMemo((): { value?: Maybe<T>; error?: unknown } => { try { return { value: load() }; } catch (error) { return { error }; } }, [id]);
  const [done, setDone] = useState<{ id: string; data?: T; error?: unknown } | null>(null);
  useEffect(() => {
    const v = asked.value;
    if (!(v instanceof Promise)) return;
    let on = true;
    v.then((data) => on && setDone({ id, data }), (error: unknown) => on && setDone({ id, error }));
    return () => { on = false; };
  }, [asked, id]);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  if ('error' in asked) return { error: asked.error, loading: false, retry };
  if (!(asked.value instanceof Promise)) return { data: asked.value as T, loading: false, retry };
  if (done?.id !== id) return { loading: true, retry };
  return { data: done.data, error: done.error, loading: false, retry };
}

/** Draws `children(data)` once loaded; <Pending> before, <Failed> on an error. */
export function Loaded<T>({ load, children, pending, className }: { load: Load<T>; children: (data: T) => ReactNode; pending?: ReactNode; className?: string }) {
  if (load.error) return <Failed error={load.error} retry={load.retry} className={className} />;
  if (load.loading) return <>{pending ?? <Pending className={className} />}</>;
  return <>{children(load.data as T)}</>;
}

export function Pending({ label = 'Loading from GitHub…', className }: { label?: string; className?: string }) {
  return (
    <Box className={cn('grid place-items-center gap-3 px-6 py-12 text-center text-muted-foreground', className)}>
      <Spinner size={20} label={label} />
      <span className="text-caption">{label}</span>
    </Box>
  );
}

/** What went wrong, in GitHub's terms, and what to do about it. */
export function Failed({ error, retry, className }: { error: unknown; retry?: () => void; className?: string }) {
  const { keychain, openPicker } = useContext(Ctx) ?? {};
  const kind = error instanceof GitHubError ? error.kind : 'other';
  const [icon, title]: [OctName, string] = {
    auth: ['lock', 'Sign in again'] as [OctName, string],
    notFound: ['eyeClosed', 'Not found'] as [OctName, string],
    rateLimit: ['history', 'Rate limited'] as [OctName, string],
    other: ['x', 'GitHub didn’t answer'] as [OctName, string],
  }[kind];
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Box className={cn('grid place-items-center px-6 py-12 text-center', className)}>
      <Oct name={icon} size={24} className="text-muted-foreground" />
      <h3 className="mt-3 mb-1 text-callout font-semibold">{title}</h3>
      <p className="m-0 max-w-[420px] text-detail text-muted-foreground">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {kind === 'auth' && keychain ? <Button className={ghButton(true)} onPress={keychain.signIn}>Sign in with GitHub</Button> : null}
        {kind === 'notFound' && openPicker ? <Button className={ghButton()} onPress={openPicker}>Choose a repository</Button> : null}
        {retry && kind !== 'auth' ? <Button className={ghButton()} onPress={retry}><Oct name="retry" />Try again</Button> : null}
      </div>
    </Box>
  );
}
