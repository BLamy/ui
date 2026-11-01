'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { createOpenCodeBrowser } from '@/lib/open-code-browser';
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
  /** Start when mounted. Set false to require the Start button. */
  autoStart?: boolean;
  /** Attach Agent Browser-compatible MCP tools for the selected app iframe. */
  browserTools?: boolean;
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
  autoStart = true,
  browserTools = true,
  onStateChange,
  onReady,
}: OpenCodeProps) {
  const terminal = useRef<HTMLDivElement>(null);
  const connection = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(autoStart);
  const [state, setState] = useState<OpenCodeState>(autoStart ? 'starting' : 'idle');
  const [error, setError] = useState('');
  const [ports, setPorts] = useState<OpenCodePort[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [version, setVersion] = useState('');
  const [previewSession, setPreviewSession] = useState('');
  const [previewPath, setPreviewPath] = useState('/');
  const [bridge, setBridge] = useState<OpenCodeHostBridge>();
  const [browserConnected, setBrowserConnected] = useState(false);
  const browser = useMemo(() => createOpenCodeBrowser({ onConnectedChange: setBrowserConnected }), []);
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
      browser.reset();
      session?.dispose();
      owned?.dispose?.();
    };
    setState('starting');
    setError('');
    setPorts([]);
    setSelected(null);
    setPreviewPath('/');
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
          if (added.length) setPreviewPath('/');
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
      const mcpServers = [
        ...(nextHost?.mcpServers ?? []),
        ...(browserTools && nextHost?.previews ? [browser.server] : []),
      ];
      if (mcpServers.length && runtime.capabilities?.hostMcp !== 1)
        throw new Error('This OpenCode runtime needs the host MCP update. Update runtimeUrl or set browserTools={false}.');
      session = await runtime.mount({
        container: terminalElement,
        connectionContainer: connectionElement,
        themeMode: theme,
        directory: nextHost?.directory,
        workspaceBridge: nextHost?.workspaceBridge,
        processBridge: nextHost?.processBridge,
        mcpServers,
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
    browserTools,
    browser,
  ]);

  const active = ports.find((port) => port.port === selected);
  const frame = useRef<HTMLIFrameElement>(null);
  // The AlmostNode worker owns one MessagePort. Replaced frames need a fresh
  // scope so a previous worker cannot send requests to its closed connection.
  const previewFrame = useMemo(
    () => ({
      key: `${previewSession}:${selected}:${revision}`,
      session: crypto.randomUUID(),
    }),
    [previewSession, selected, revision],
  );
  const previewSrc =
    active && previewSession
      ? openCodePreviewFrameUrl(
          previewRuntimeUrl,
          previewFrame.session,
          active.port,
          window.location.href,
          previewPath,
        )
      : '';
  useEffect(() => {
    if (!frame.current || !bridge || !previewSrc || selected === null) return;
    return connectOpenCodePreview({
      frame: frame.current,
      host: bridge,
      session: previewFrame.session,
      port: selected,
      url: previewSrc,
      onError: setError,
      browser: browserTools ? browser : undefined,
      onNavigate: (path) => { setPreviewPath(path); setRevision((value) => value + 1); },
    });
  }, [bridge, previewSrc, previewFrame, selected, browser, browserTools]);
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
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground',
        className,
      )}
      style={{ height: Math.max(320, height), ...style }}
      aria-label={title}
      data-state={state}
    >
      <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-sm">
        <strong>
          {title}
          {version && (
            <span className="ml-2 font-normal text-muted-foreground">
              v{version}
            </span>
          )}
        </strong>
        <span className="text-xs text-muted-foreground" role="status">
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
          className="appearance-none rounded-md border border-border bg-transparent px-3 py-1 font-sans text-xs focus-visible:outline-2 focus-visible:outline-ring"
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
          className="m-3 rounded-lg bg-muted p-3 text-sm"
        >
          {error}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 bg-muted p-2">
          <div
            ref={terminal}
            className="h-full min-h-0"
            aria-label={`${title} terminal`}
          />
          {state === 'starting' && (
            <p className="pointer-events-none absolute inset-0 m-auto flex max-w-sm items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Loading OpenCode and its WebAssembly renderer…
            </p>
          )}
          {!started && (
            <p className="absolute inset-0 m-auto flex max-w-sm items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Start OpenCode to edit files and run commands in this browser.
              Servers opened by the host appear here as live previews.
            </p>
          )}
        </div>
        {ports.length > 0 && (
          <aside
            className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border md:border-t-0 md:border-l"
            aria-label="App preview"
          >
            <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
              <span>Preview</span>
              {browserTools && active && (
                <span className="text-muted-foreground" title="Agent Browser-compatible tools connected to this app iframe">
                  Browser MCP · {browserConnected ? 'ready' : 'connecting'}
                </span>
              )}
              {ports.map((port) => (
                <button
                  key={port.port}
                  type="button"
                  aria-pressed={selected === port.port}
                  className="appearance-none rounded border border-border bg-transparent px-2 py-1 font-sans aria-pressed:bg-muted"
                  onClick={() => { setPreviewPath('/'); setSelected(port.port); }}
                >
                  {port.name ?? `Port ${port.port}`}
                </button>
              ))}
              {active && (
                <>
                  <button
                    type="button"
                    className="ml-auto appearance-none rounded border border-border bg-transparent px-2 py-1 font-sans"
                    onClick={() => setRevision((value) => value + 1)}
                    aria-label="Reload app preview"
                  >
                    Reload
                  </button>
                  <button
                    type="button"
                    className="appearance-none rounded border border-border bg-transparent px-2 py-1 font-sans"
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
                key={previewFrame.key}
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
              <p className="p-4 text-sm text-muted-foreground">
                Select a port to open its app.
              </p>
            )}
          </aside>
        )}
      </div>
      <p className="m-0 shrink-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Sessions and provider credentials stay in memory. Preview apps run in a
        sandboxed frame.
      </p>
    </section>
  );
}
