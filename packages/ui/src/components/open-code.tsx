'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icon';
import { calloutVariants } from '@/lib/primitives';
import { useAppearance, useThemeScope, type AppearancePreference } from '@/lib/theme';
import { useSizeClass } from '@/lib/container';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
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
  type OpenCodeCredentialStore,
  type OpenCodeConnectionStore,
  type OpenCodePort,
  type OpenCodeRuntime,
  type OpenCodeRuntimeSession,
} from '@/lib/open-code-host';

export type OpenCodeState =
  'idle' | 'starting' | 'running' | 'error' | 'stopped';

/** The frame: `card` is a bordered, rounded card for a page; `plain` has no border or radius, for a pane or window
    that already draws its own edge. Size it with `className` (it is at least 320px tall). */
export const openCodeVariants = cva(
  'group/open-code flex min-h-80 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground',
  {
    variants: {
      variant: {
        card: 'rounded-card border border-border',
        plain: '',
      },
    },
    defaultVariants: { variant: 'card' },
  },
);

/** Where the workspace comes from: borrow a `host`, or `createHost` a fresh one on each Start (disposed on Stop). One or
    the other, never both; with neither, the runtime runs without a workspace bridge. */
export type OpenCodeHostProps =
  | {
      /** An existing host to borrow. It is not disposed on Stop. */
      host?: OpenCodeHostBridge;
      createHost?: never;
    }
  | {
      host?: never;
      /** Makes a fresh host on each Start; it is disposed on Stop. */
      createHost?: () => OpenCodeHostBridge | Promise<OpenCodeHostBridge>;
    };

export interface OpenCodeBaseProps
  extends Omit<ComponentProps<'section'>, 'children' | 'title'>,
    VariantProps<typeof openCodeVariants> {
  /** Supported encrypted host store. Locking stops the terminal; autoStart restores it after unlocking. */
  credentialStore?: OpenCodeCredentialStore;
  /** Encrypted connection choice, Tailscale session and exit node. Uses the same unlock lifecycle as credentialStore. */
  connectionStore?: OpenCodeConnectionStore;
  runtimeUrl?: string;
  /** Hosts AlmostNode's worker and bootstrap on a separate origin. */
  previewRuntimeUrl?: string;
  /** Supply an application-bundled runtime instead of the hosted module. */
  loadRuntime?: () => Promise<OpenCodeRuntime>;
  /** The visible title, and the name of the region, its terminal and its preview frames. Default `OpenCode`. */
  title?: string;
  /** The terminal's color scheme. `'auto'` (the default) follows the nearest ThemeScope, else the ambient appearance, else
      the system setting, as CodeEditor's does. Changing it restarts the session. */
  appearance?: AppearancePreference;
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

export type OpenCodeProps = OpenCodeBaseProps & OpenCodeHostProps;

/* ══ OpenCode — a real OpenCode TUI beside the HTTP apps its host runtime starts ══
   The kit's Button runs Start/Stop, Reload and Close; the open ports are a ToggleGroup (one tab stop, arrows
   between ports). The terminal and the preview sit side by side unless the component's own box is compact
   (`data-size-class` from `useSizeClass`), where the preview stacks under the terminal. */
/** The system's light / dark setting, for `appearance="auto"` with no scope or provider around. */
const DARK_QUERY = '(prefers-color-scheme: dark)';
const subscribeSystemDark = (notify: () => void) => {
  const query = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null;
  query?.addEventListener('change', notify);
  return () => query?.removeEventListener('change', notify);
};
const readSystemDark = () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;

export function OpenCode({
  host,
  credentialStore,
  connectionStore,
  createHost,
  runtimeUrl,
  previewRuntimeUrl = DEFAULT_OPENCODE_PREVIEW_URL,
  loadRuntime,
  title = 'OpenCode',
  appearance: appearanceProp,
  variant,
  className,
  autoStart = true,
  browserTools = true,
  onStateChange,
  onReady,
  ref,
  ...props
}: OpenCodeProps) {
  const scopeAppearance = useThemeScope()?.appearance;
  const ambient = useAppearance();
  // `auto` resolves as CodeEditor's does: the nearest scope, the provider, then the system setting.
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const theme = (appearanceProp === 'auto' ? undefined : appearanceProp) ?? scopeAppearance ?? ambient ?? (systemDark ? 'dark' : 'light');
  const terminal = useRef<HTMLDivElement>(null);
  const [sizeRef] = useSizeClass<HTMLElement>();
  const rootRef = useMemo(
    () => (el: HTMLElement | null) => {
      sizeRef(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [sizeRef, ref],
  );
  const connection = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(autoStart);
  const stores = useMemo(
    () =>
      [credentialStore, connectionStore].filter((store) => store !== undefined),
    [credentialStore, connectionStore],
  );
  const keychain = useMemo(
    () => ({
      subscribe: (listener: () => void) => {
        const off = stores.map((store) => store.subscribe(listener));
        return () => off.forEach((unsubscribe) => unsubscribe());
      },
      getSnapshot: () => stores.every((store) => store.unlocked()),
      getServerSnapshot: () => stores.length === 0,
    }),
    [stores],
  );
  const unlocked = useSyncExternalStore(
    keychain.subscribe,
    keychain.getSnapshot,
    keychain.getServerSnapshot,
  );
  const availability = useRef(unlocked);
  const [keychainRevision, setKeychainRevision] = useState(0);
  const [state, setState] = useState<OpenCodeState>(
    autoStart ? 'starting' : 'idle',
  );
  const [error, setError] = useState('');
  const [ports, setPorts] = useState<OpenCodePort[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [version, setVersion] = useState('');
  const [previewSession, setPreviewSession] = useState('');
  const [previewPath, setPreviewPath] = useState('/');
  const [bridge, setBridge] = useState<OpenCodeHostBridge>();
  const [browserConnected, setBrowserConnected] = useState(false);
  const browser = useMemo(
    () => createOpenCodeBrowser({ onConnectedChange: setBrowserConnected }),
    [],
  );
  const callbacks = useRef({ onStateChange, onReady });
  callbacks.current = { onStateChange, onReady };
  useEffect(() => {
    callbacks.current.onStateChange?.(state);
  }, [state]);

  useEffect(() => {
    if (availability.current === unlocked) return;
    availability.current = unlocked;
    setStarted(unlocked && autoStart);
    setState(unlocked && autoStart ? 'starting' : 'stopped');
    setPorts([]);
    setSelected(null);
    if (unlocked) setKeychainRevision((value) => value + 1);
  }, [unlocked, autoStart]);

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
      if (credentialStore && runtime.capabilities?.credentialStore !== 1)
        throw new Error(
          'This OpenCode runtime needs the encrypted keychain bridge (credentialStore v1). Update the runtime before saving sign-ins.',
        );
      if (connectionStore && runtime.capabilities?.connectionStore !== 1)
        throw new Error(
          'This OpenCode runtime needs the encrypted connection bridge (connectionStore v1). Update the runtime before restoring Tailscale.',
        );
      setVersion(runtime.version ?? '');
      const mcpServers = [
        ...(nextHost?.mcpServers ?? []),
        ...(browserTools && nextHost?.previews ? [browser.server] : []),
      ];
      if (mcpServers.length && runtime.capabilities?.hostMcp !== 1)
        throw new Error(
          'This OpenCode runtime needs the host MCP update. Update runtimeUrl or set browserTools={false}.',
        );
      session = await runtime.mount({
        container: terminalElement,
        connectionContainer: connectionElement,
        themeMode: theme,
        directory: nextHost?.directory,
        workspaceBridge: nextHost?.workspaceBridge,
        processBridge: nextHost?.processBridge,
        credentialStore,
        connectionStore,
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
    credentialStore,
    connectionStore,
    createHost,
    loadRuntime,
    runtimeUrl,
    previewRuntimeUrl,
    theme,
    keychainRevision,
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
      onNavigate: (path) => {
        setPreviewPath(path);
        setRevision((value) => value + 1);
      },
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
      {...props}
      ref={rootRef}
      className={cn(openCodeVariants({ variant }), className)}
      aria-label={title}
      data-state={state}
    >
      <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-footnote">
        <strong>
          {title}
          {version && (
            <span className="ml-2 font-normal text-muted-foreground">
              v{version}
            </span>
          )}
        </strong>
        <span className="text-caption text-muted-foreground" role="status">
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
        {/* The runtime's connection control and Start / Stop stay together at the end, also when the header wraps. */}
        <div className="ml-auto flex items-center gap-2">
          <div ref={connection} />
          {/* Stopped, the Start button is the empty terminal's action, next to what it explains. */}
          {started ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStarted(false);
                setState('stopped');
                setPorts([]);
                setSelected(null);
                setError('');
              }}
            >
              Stop OpenCode
            </Button>
          ) : null}
        </div>
      </header>
      {error && (
        <p role="alert" className={cn(calloutVariants({ tone: 'destructive' }), 'm-3')}>
          <Icon name="exclamation-circle" size={16} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-row group-data-[size-class=compact]/open-code:flex-col">
        <div className="relative min-h-0 min-w-0 flex-1 bg-muted p-2">
          <div
            ref={terminal}
            role="group"
            className="h-full min-h-0"
            aria-label={`${title} terminal`}
          />
          {state === 'starting' && (
            <p className="pointer-events-none absolute inset-0 m-auto flex max-w-sm items-center justify-center p-6 text-center text-footnote text-muted-foreground">
              Loading OpenCode and its WebAssembly renderer…
            </p>
          )}
          {!started && (
            <EmptyState
              className="absolute inset-0"
              icon={<Icon name="keyboard" />}
              title={state === 'stopped' ? `${title} stopped` : state === 'error' ? `${title} could not start` : `${title} isn't running`}
              description={state === 'error'
                ? 'Check the runtime and try again.'
                : 'Start it to edit files and run commands in this browser. Servers the host opens appear beside it as live previews.'}
              action={<Button size="sm" onClick={() => setStarted(true)}>{state === 'error' ? 'Try again' : 'Start OpenCode'}</Button>}
            />
          )}
        </div>
        {ports.length > 0 && (
          <aside
            className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border group-data-[size-class=compact]/open-code:border-t group-data-[size-class=compact]/open-code:border-l-0"
            aria-label="App preview"
          >
            <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-caption">
              <span>Preview</span>
              {browserTools && active && (
                <span
                  className="text-muted-foreground"
                  title="Agent Browser-compatible tools connected to this app iframe"
                >
                  Browser MCP · {browserConnected ? 'ready' : 'connecting'}
                </span>
              )}
              <ToggleGroup
                aria-label="Preview port"
                size="sm"
                deselectable={false}
                value={selected === null ? [] : [String(selected)]}
                onValueChange={(value) => {
                  const port = Number(value[0]);
                  if (!value.length || port === selected) return;
                  setPreviewPath('/');
                  setSelected(port);
                }}
              >
                {ports.map((port) => (
                  <ToggleGroupItem key={port.port} value={String(port.port)}>
                    {port.name ?? `Port ${port.port}`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {active && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setRevision((value) => value + 1)}
                    aria-label="Reload app preview"
                  >
                    Reload
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(null)}
                    aria-label="Close app preview"
                  >
                    Close
                  </Button>
                </>
              )}
            </div>
            {active ? (
              // A browser paints a page with no background of its own on white; an iframe would show ours.
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
              <p className="p-4 text-footnote text-muted-foreground">
                Select a port to open its app.
              </p>
            )}
          </aside>
        )}
      </div>
      <p className="m-0 shrink-0 border-t border-border px-3 py-2 text-caption text-muted-foreground">
        {connectionStore
          ? 'Connections and provider sign-ins use your Passwords keychain. Unlock it after a refresh to restore them.'
          : credentialStore
            ? 'Provider sign-ins use your keychain. Locking it stops this terminal. Sessions stay in memory.'
            : 'Sessions and provider credentials stay in memory. Preview apps run in a sandboxed frame.'}
      </p>
    </section>
  );
}
