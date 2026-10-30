'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
  connectOpenCodePreview,
  DEFAULT_OPENCODE_PREVIEW_URL,
  openCodePreviewFrameUrl,
} from '@/lib/open-code-preview';
import {
  loadOpenCodeRuntime,
  openCodePreviewUrl,
  type OpenCodeHostBridge,
  type OpenCodePort,
  type OpenCodeRuntime,
  type OpenCodeRuntimeSession,
} from '@/lib/open-code-host';

export type OpenCodeState =
  'idle' | 'starting' | 'running' | 'error' | 'stopped';

export interface OpenCodeProps {
  /** Borrow an existing host, or create a fresh one on each Start (disposed on Stop). */
  host?: OpenCodeHostBridge;
  createHost?: () => OpenCodeHostBridge | Promise<OpenCodeHostBridge>;
  runtimeUrl?: string;
  /** Hosts AlmostNode's worker and bootstrap on a separate origin. */
  previewRuntimeUrl?: string;
  /** Supply an application-bundled runtime instead of the hosted module. */
  loadRuntime?: () => Promise<OpenCodeRuntime>;
  title?: string;
  height?: number;
  className?: string;
  style?: CSSProperties;
  theme?: 'light' | 'dark';
  autoStart?: boolean;
  onStateChange?: (state: OpenCodeState) => void;
  onReady?: (
    session: OpenCodeRuntimeSession,
    host?: OpenCodeHostBridge,
  ) => void;
}

/** A real OpenCode TUI beside the HTTP apps started by its host runtime. */
export function OpenCode({
  host,
  createHost,
  runtimeUrl,
  previewRuntimeUrl = DEFAULT_OPENCODE_PREVIEW_URL,
  loadRuntime,
  title = 'OpenCode',
  height = 620,
  className,
  style,
  theme = 'dark',
  autoStart = false,
  onStateChange,
  onReady,
}: OpenCodeProps) {
  const terminal = useRef<HTMLDivElement>(null);
  const connection = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(autoStart);
  const [state, setState] = useState<OpenCodeState>('idle');
  const [error, setError] = useState('');
  const [ports, setPorts] = useState<OpenCodePort[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [version, setVersion] = useState('');
  const [previewSession, setPreviewSession] = useState('');
  const [bridge, setBridge] = useState<OpenCodeHostBridge>();
  const callbacks = useRef({ onStateChange, onReady });
  callbacks.current = { onStateChange, onReady };
  useEffect(() => {
    callbacks.current.onStateChange?.(state);
  }, [state]);

  useEffect(() => {
    if (!started || !terminal.current || !connection.current) return;
    const terminalElement = terminal.current;
    const connectionElement = connection.current;
    let cancelled = false;
    let session: OpenCodeRuntimeSession | undefined;
    let owned: OpenCodeHostBridge | undefined;
    let unsubscribe: (() => void) | undefined;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      unsubscribe?.();
      session?.dispose();
      owned?.dispose?.();
    };
    setState('starting');
    setError('');
    setPorts([]);
    setSelected(null);
    void (async () => {
      if (host && createHost)
        throw new Error('Choose host or createHost, not both.');
      const nextHost = host ?? (owned = await createHost?.());
      if (cancelled) {
        owned?.dispose?.();
        return;
      }
      setBridge(nextHost);
      const previewId = crypto.randomUUID();
      openCodePreviewFrameUrl(
        previewRuntimeUrl,
        previewId,
        3000,
        window.location.href,
      );
      setPreviewSession(previewId);
      await nextHost?.previews?.ready();
      if (cancelled) return;
      if (nextHost?.previews) {
        const previews = nextHost.previews;
        let previous = new Set<number>();
        const sync = () => {
          const next = previews.list().map((port) => ({
            ...port,
            url: openCodePreviewUrl(port, window.location.href),
          }));
          const added = next.filter((port) => !previous.has(port.port));
          previous = new Set(next.map((port) => port.port));
          setPorts(next);
          setSelected(
            (current) =>
              added.at(-1)?.port ??
              (next.some((port) => port.port === current) ? current : null),
          );
        };
        sync();
        unsubscribe = previews.subscribe(() => {
          try {
            sync();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        });
      }
      const runtime = await (loadRuntime
        ? loadRuntime()
        : loadOpenCodeRuntime(runtimeUrl));
      if (cancelled) return;
      setVersion(runtime.version ?? '');
      session = await runtime.mount({
        container: terminalElement,
        connectionContainer: connectionElement,
        themeMode: theme,
        directory: nextHost?.directory,
        workspaceBridge: nextHost?.workspaceBridge,
        processBridge: nextHost?.processBridge,
      });
      if (cancelled) {
        session.dispose();
        return;
      }
      setState('running');
      callbacks.current.onReady?.(session, nextHost);
      if (session.exited) {
        await session.exited;
        if (!cancelled) {
          setStarted(false);
          setState('stopped');
          setPorts([]);
          setSelected(null);
        }
      }
    })().catch((reason: unknown) => {
      if (cancelled) return;
      cleanup();
      setStarted(false);
      setState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      cancelled = true;
      cleanup();
      setBridge(undefined);
    };
  }, [
    started,
    host,
    createHost,
    loadRuntime,
    runtimeUrl,
    previewRuntimeUrl,
    theme,
  ]);

  const active = ports.find((port) => port.port === selected);
  const frame = useRef<HTMLIFrameElement>(null);
  const previewSrc =
    active && previewSession
      ? openCodePreviewFrameUrl(
          previewRuntimeUrl,
          previewSession,
          active.port,
          window.location.href,
        )
      : '';
  useEffect(() => {
    if (!frame.current || !bridge || !previewSrc || selected === null) return;
    return connectOpenCodePreview({
      frame: frame.current,
      host: bridge,
      session: previewSession,
      port: selected,
      url: previewSrc,
      onError: setError,
    });
  }, [bridge, previewSrc, previewSession, selected, revision]);
  useEffect(() => {
    if (selected === null || !ports.some((port) => port.port === selected))
      return;
    const port = selected;
    bridge?.previews?.setTarget?.(port, frame.current?.contentWindow ?? null);
    return () => bridge?.previews?.setTarget?.(port, null);
  }, [selected, ports, bridge, revision]);

  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-separator bg-background',
        className,
      )}
      style={{ height: Math.max(320, height), ...style }}
      aria-label={title}
      data-state={state}
    >
      <header className="flex min-h-11 flex-wrap items-center gap-3 border-b border-separator px-3 py-2 text-sm">
        <strong>
          {title}
          {version && (
            <span className="ml-2 font-normal text-secondary-label">
              v{version}
            </span>
          )}
        </strong>
        <span className="text-xs text-secondary-label" role="status">
          {state === 'starting'
            ? 'Starting WebAssembly…'
            : state === 'running'
              ? 'Running locally · WebAssembly'
              : state === 'error'
                ? 'Could not start'
                : state === 'stopped'
                  ? 'Stopped'
                  : 'Ready to start'}
        </span>
        <div ref={connection} className="ml-auto" />
        <button
          type="button"
          className="rounded-md border border-separator px-3 py-1 text-xs focus-visible:outline-2 focus-visible:outline-tint"
          onClick={() => {
            if (started) {
              setStarted(false);
              setState('stopped');
              setPorts([]);
              setSelected(null);
              setError('');
            } else setStarted(true);
          }}
        >
          {started ? 'Stop OpenCode' : 'Start OpenCode'}
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="m-3 rounded-lg bg-secondary-background p-3 text-sm"
        >
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-wrap">
        <div className="relative min-h-60 min-w-0 flex-[1_1_420px] bg-secondary-background p-2">
          <div
            ref={terminal}
            className="h-full min-h-60"
            aria-label={`${title} terminal`}
          />
          {!started && (
            <p className="absolute inset-0 m-auto flex max-w-sm items-center justify-center p-6 text-center text-sm text-secondary-label">
              Start OpenCode to edit files and run commands in this browser.
              Servers opened by the host appear here as live previews.
            </p>
          )}
        </div>
        {ports.length > 0 && (
          <aside
            className="flex min-h-60 min-w-0 flex-[1_1_400px] flex-col border-l border-separator"
            aria-label="App preview"
          >
            <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-separator px-3 py-2 text-xs">
              <span>Preview</span>
              {ports.map((port) => (
                <button
                  key={port.port}
                  type="button"
                  aria-pressed={selected === port.port}
                  className="rounded border border-separator px-2 py-1 aria-pressed:bg-secondary-background"
                  onClick={() => setSelected(port.port)}
                >
                  {port.name ?? `Port ${port.port}`}
                </button>
              ))}
              {active && (
                <>
                  <button
                    type="button"
                    className="ml-auto"
                    onClick={() => setRevision((value) => value + 1)}
                    aria-label="Reload app preview"
                  >
                    Reload
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close app preview"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
            {active ? (
              <iframe
                key={`${active.port}:${revision}`}
                ref={frame}
                src={previewSrc}
                title={`${title} · ${active.name ?? `port ${active.port}`}`}
                sandbox="allow-scripts allow-forms allow-same-origin"
                referrerPolicy="no-referrer"
                className="min-h-0 w-full flex-1 border-0 bg-white"
                onLoad={() =>
                  bridge?.previews?.setTarget?.(
                    active.port,
                    frame.current?.contentWindow ?? null,
                  )
                }
              />
            ) : (
              <p className="p-4 text-sm text-secondary-label">
                Select a port to open its app.
              </p>
            )}
          </aside>
        )}
      </div>
      <p className="m-0 border-t border-separator px-3 py-2 text-xs text-secondary-label">
        Sessions and provider credentials stay in memory. Preview apps run in a
        sandboxed frame.
      </p>
    </section>
  );
}
