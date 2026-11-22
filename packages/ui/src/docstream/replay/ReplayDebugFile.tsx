import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAsset } from '../asset-resolver';
import type { ReplayFileData } from '@brett_lamy/ui/replay-debugger';

/* A `.replay` file: Replay recordings read once with the linker and written down as JSON, one recording
   (`bl-replay-cache/…`) or a session of several (`bl-replay-session/…`). An embed of one opens a time travel debugger
   over it, the way an `.rrweb` file opens the replay player, with no engine anywhere. The URL goes through the host's
   `AssetResolverProvider`; the file is fetched, and the debugger loaded, only once the frame nears the viewport. */

const ReplayView = lazy(() => import('@brett_lamy/ui/replay-debugger').then((m) => ({ default: m.ReplayView })));

export interface ReplayDebugFileProps {
  /** The `.replay` file as written in the document. */
  url: string;
  title?: string;
  /** For a session: the page and its requests, or the debugger over every recording. Default: whichever fits. */
  view?: 'auto' | 'requests' | 'debugger';
}

export function ReplayDebugFile({ url, title, view }: ReplayDebugFileProps) {
  const src = useAsset(url);
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<{ data?: ReplayFileData; error?: string }>({});

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || src === undefined) return;
    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`))))
      .then((data: ReplayFileData) => {
        if (typeof data?.format !== 'string' || !/^bl-replay-(cache|session)\//.test(data.format)) throw new Error('not a .replay file');
        setState({ data });
      })
      .catch((error: Error) => !controller.signal.aborted && setState({ error: error.message }));
    return () => controller.abort();
  }, [near, src]);

  const label = title ?? url.split('/').pop();
  return (
    <figure ref={ref} className="docstream-replay-debug" data-slot="replay-debug-file" aria-label={label} aria-busy={!state.data && !state.error}>
      {state.error ? (
        <div className="docstream-replay-debug__message">Couldn't open {label}: {state.error}</div>
      ) : state.data ? (
        <Suspense fallback={<div className="docstream-replay-debug__message">Opening the debugger…</div>}>
          <ReplayView data={state.data} view={view} />
        </Suspense>
      ) : (
        <div className="docstream-replay-debug__message">Loading {label}…</div>
      )}
    </figure>
  );
}

const REPLAY = /\.replay(?:[?#]|$)/i;

/** True for a `.replay` file: Replay recordings read once into JSON, which open in the time travel debugger. */
export function isReplayDebugUrl(url: string): boolean {
  return REPLAY.test(url.trim());
}
