/** Structural bridge contracts: importing BL UI never loads a Node runtime. */
export interface OpenCodeWorkspaceStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  mtimeMs: number;
}

export interface OpenCodeWorkspaceBridge {
  exists(path: string): boolean;
  mkdir(path: string): void;
  readFile(path: string): string | undefined;
  writeFile(path: string, content: string): void;
  readdir(
    path: string,
  ): { name: string; isDirectory(): boolean; isFile(): boolean }[];
  stat(path: string): OpenCodeWorkspaceStats | undefined;
  remove?(path: string, options?: { recursive?: boolean }): void;
  rename?(from: string, to: string): void;
  listFiles?(root?: string): string[];
}

export interface OpenCodeCommand {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  shell?: boolean | string;
  signal?: AbortSignal;
}

export interface OpenCodeProcessBridge {
  exec(
    input: OpenCodeCommand,
  ): Promise<{ stdout: string; stderr: string; code: number }>;
}

export interface OpenCodePort {
  port: number;
  url: string;
  name?: string;
}

export interface OpenCodeHostBridge {
  id: string;
  directory: string;
  workspaceBridge: OpenCodeWorkspaceBridge;
  processBridge: OpenCodeProcessBridge;
  previews?: {
    /** Register the host's service worker before opening any preview. Must not reload the page. */
    ready(): Promise<void>;
    list(): OpenCodePort[];
    subscribe(listener: () => void): () => void;
    /** Dispatch HTTP requests from AlmostNode's service worker to this container. */
    fetch(port: number, request: Request): Promise<Response>;
    setTarget?(port: number, target: Window | null): void;
  };
  dispose?(): void;
}

/** Both AlmostNode and @agent-wasm/core ContainerInstance satisfy this interface. */
export interface AlmostNodeOpenCodeContainer {
  id: string;
  vfs: {
    existsSync(path: string): boolean;
    mkdirSync(path: string, options: { recursive: boolean }): void;
    readFileSync(path: string, encoding: 'utf8'): string;
    writeFileSync(path: string, content: string): void;
    readdirSync(path: string): string[];
    statSync(path: string): OpenCodeWorkspaceStats;
    renameSync(from: string, to: string): void;
    unlinkSync(path: string): void;
    rmdirSync(path: string): void;
  };
  run(
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  serverBridge: {
    ensureServiceWorkerReady(options: {
      swUrl?: string;
      reloadOnFirstControl: boolean;
    }): Promise<void>;
    getServerPorts(): number[];
    getServerMetadata(
      port: number,
    ): { ownerId?: string; purpose?: string; name?: string } | undefined;
    getServerUrl(port: number): string;
    handleRequest(
      port: number,
      method: string,
      url: string,
      headers: Record<string, string>,
      body?: ArrayBuffer,
    ): Promise<{
      statusCode: number;
      statusMessage?: string;
      headers: Record<string, string>;
      body: Uint8Array;
    }>;
    on(event: string, listener: (...args: unknown[]) => void): unknown;
    off(event: string, listener: (...args: unknown[]) => void): unknown;
  };
  setHMRTargetForPort?(port: number, target: Window | null): void;
  dispose(): void;
}

export interface AlmostNodeOpenCodeOptions {
  directory?: string;
  serviceWorkerUrl?: string;
  /** The adapter otherwise borrows the container. */
  disposeContainer?: boolean;
}

/** Connect OpenCode's real tools to an existing runtime's files, shell and HTTP servers. */
export function createAlmostNodeOpenCodeHost(
  container: AlmostNodeOpenCodeContainer,
  options: AlmostNodeOpenCodeOptions = {},
): OpenCodeHostBridge {
  const vfs = container.vfs;
  const directory = (
    options.directory ?? `/workspaces/${container.id}`
  ).replace(/\/+$/, '');
  if (
    !directory.startsWith('/') ||
    directory.split('/').some((part) => part === '..' || part === '.')
  )
    throw new Error('OpenCode needs an absolute workspace directory below /.');
  vfs.mkdirSync(directory, { recursive: true });
  const path = (input: string) => {
    const parts: string[] = [];
    for (const part of input.split('/')) {
      if (part === '..') parts.pop();
      else if (part && part !== '.') parts.push(part);
    }
    const normalized = '/' + parts.join('/');
    if (normalized !== directory && !normalized.startsWith(directory + '/'))
      throw new Error('OpenCode path is outside its workspace: ' + input);
    return normalized;
  };
  const listFiles = (root = directory): string[] =>
    vfs.readdirSync(path(root)).flatMap((name) => {
      const child = `${root}/${name}`;
      return vfs.statSync(child).isDirectory() ? listFiles(child) : [child];
    });
  const remove = (input: string, recursive = false) => {
    const target = path(input);
    if (vfs.statSync(target).isDirectory()) {
      if (recursive)
        for (const name of vfs.readdirSync(target))
          remove(`${target}/${name}`, true);
      vfs.rmdirSync(target);
    } else vfs.unlinkSync(target);
  };
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const subscribers = new Set<() => void>();
  const changed = () => {
    for (const listener of subscribers) listener();
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  let signature = '';
  const list = (): OpenCodePort[] =>
    container.serverBridge.getServerPorts().flatMap((port) => {
      const metadata = container.serverBridge.getServerMetadata(port);
      // The bridge is shared with other containers and Docstream playgrounds.
      if (
        metadata?.ownerId !== container.id ||
        metadata.purpose === 'auxiliary'
      )
        return [];
      return [
        {
          port,
          url: container.serverBridge.getServerUrl(port) + '/',
          name: metadata.name,
        },
      ];
    });
  const stopWatching = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    container.serverBridge.off('server-ready', changed);
  };
  let disposed = false;
  return {
    id: container.id,
    directory,
    workspaceBridge: {
      exists: (input) => vfs.existsSync(path(input)),
      mkdir: (input) => vfs.mkdirSync(path(input), { recursive: true }),
      readFile: (input) =>
        vfs.existsSync(path(input))
          ? vfs.readFileSync(path(input), 'utf8')
          : undefined,
      writeFile: (input, content) => vfs.writeFileSync(path(input), content),
      stat: (input) =>
        vfs.existsSync(path(input)) ? vfs.statSync(path(input)) : undefined,
      readdir: (input) =>
        vfs.readdirSync(path(input)).map((name) => {
          const stats = vfs.statSync(`${input}/${name}`);
          return {
            name,
            isDirectory: () => stats.isDirectory(),
            isFile: () => stats.isFile(),
          };
        }),
      listFiles,
      remove: (input, opts) => remove(input, opts?.recursive),
      rename: (from, to) => vfs.renameSync(path(from), path(to)),
    },
    processBridge: {
      async exec(input) {
        if (disposed) throw new Error('OpenCode host has been disposed.');
        if (input.stdin)
          throw new Error(
            'This container adapter does not support piped stdin. Use a shell pipe or supply a custom processBridge.',
          );
        const shell = /(?:^|\/)(?:ba|z|da)?sh$/.test(input.command);
        const command =
          shell && input.args[0] === '-c'
            ? input.args[1]
            : input.shell
              ? [input.command, ...input.args.map(quote)].join(' ')
              : [input.command, ...input.args].map(quote).join(' ');
        const result = await container.run(command ?? '', {
          cwd: path(input.cwd ?? directory),
          env: input.env,
          signal: input.signal,
        });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          code: result.exitCode,
        };
      },
    },
    previews: {
      ready: () =>
        options.serviceWorkerUrl
          ? container.serverBridge.ensureServiceWorkerReady({
              swUrl: options.serviceWorkerUrl,
              reloadOnFirstControl: false,
            })
          : Promise.resolve(),
      async fetch(port, request) {
        if (!list().some((entry) => entry.port === port))
          return new Response('This app port is closed.', { status: 503 });
        const url = new URL(request.url);
        const response = await container.serverBridge.handleRequest(
          port,
          request.method,
          url.pathname + url.search,
          Object.fromEntries(request.headers),
          request.method === 'GET' || request.method === 'HEAD'
            ? undefined
            : await request.arrayBuffer(),
        );
        const headers = new Headers(response.headers);
        headers.delete('set-cookie');
        return new Response(
          request.method === 'HEAD' ||
            [204, 205, 304].includes(response.statusCode)
            ? null
            : new Uint8Array(response.body),
          {
            status: response.statusCode,
            statusText: response.statusMessage,
            headers,
          },
        );
      },
      list,
      subscribe(listener) {
        subscribers.add(listener);
        if (subscribers.size === 1) {
          signature = JSON.stringify(list());
          container.serverBridge.on('server-ready', changed);
          // Core 0.4 emits server-ready but no close event. Reconcile closures/replacements too.
          timer = setInterval(() => {
            const next = JSON.stringify(list());
            if (next !== signature) {
              signature = next;
              changed();
            }
          }, 500);
        }
        return () => {
          subscribers.delete(listener);
          if (!subscribers.size) stopWatching();
        };
      },
      setTarget: (port, target) =>
        container.setHMRTargetForPort?.(port, target),
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopWatching();
      subscribers.clear();
      if (options.disposeContainer) container.dispose();
    },
  };
}

export const createAgentWasmOpenCodeHost = createAlmostNodeOpenCodeHost;

export interface OpenCodeRuntimeSession {
  dispose(): void;
  exited?: Promise<void>;
}

export interface OpenCodeRuntime {
  version?: string;
  mount(options: {
    container: HTMLElement;
    connectionContainer: HTMLElement;
    directory?: string;
    workspaceBridge?: OpenCodeWorkspaceBridge;
    processBridge?: OpenCodeProcessBridge;
    themeMode?: 'light' | 'dark';
  }): Promise<OpenCodeRuntimeSession>;
}

export const DEFAULT_OPENCODE_RUNTIME_URL =
  'https://blamy.github.io/opencode/runtime.js';

/** Runtime code is an explicit trusted host capability, loaded only after Start. */
export async function loadOpenCodeRuntime(
  url = DEFAULT_OPENCODE_RUNTIME_URL,
): Promise<OpenCodeRuntime> {
  const runtime = (await import(/* @vite-ignore */ url)) as OpenCodeRuntime;
  if (typeof runtime.mount !== 'function')
    throw new Error('The OpenCode runtime must export mount().');
  return runtime;
}

/** Only preview the service-worker path on this origin, never a host-supplied remote URL. */
export function openCodePreviewUrl(port: OpenCodePort, base: string): string {
  if (!Number.isInteger(port.port) || port.port < 1 || port.port > 65535)
    throw new Error('Invalid OpenCode preview port.');
  const origin = new URL(base);
  const url = new URL(port.url, origin);
  if (
    url.origin !== origin.origin ||
    !url.pathname.endsWith(`/__virtual__/${port.port}/`) ||
    url.search ||
    url.hash
  )
    throw new Error(
      'OpenCode previews must use the host service worker on this origin.',
    );
  return url.href;
}
