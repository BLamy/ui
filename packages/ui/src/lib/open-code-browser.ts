import type { OpenCodeMcpServer } from '@/lib/open-code-host';

// Supported arguments from vercel-labs/agent-browser's MCP surface. This is a
// DOM iframe adapter, not its native CDP/WebDriver binary. See the OpenCode docs.
const selector = {
  type: 'string',
  description: 'CSS selector or @ref from the latest snapshot.',
};
const tools: OpenCodeMcpServer['tools'] = [
  {
    name: 'agent_browser_snapshot',
    description:
      'Read the live app iframe as a semantic DOM snapshot with @refs. Use interactive:false to include page text. The iframe is already selected.',
    inputSchema: {
      type: 'object',
      properties: {
        selector,
        interactive: { type: 'boolean', default: true },
        includeUrls: { type: 'boolean' },
        depth: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_click',
    description:
      'Click a button or link in the app preview using a snapshot @ref or CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  ...['fill', 'type'].map((action) => ({
    name: `agent_browser_${action}`,
    description: `${action === 'fill' ? 'Replace' : 'Append to'} an app input value and dispatch input/change events.`,
    inputSchema: {
      type: 'object' as const,
      properties: { selector, text: { type: 'string' } },
      required: ['selector', 'text'],
      additionalProperties: false,
    },
  })),
  {
    name: 'agent_browser_press',
    description:
      'Dispatch a key in the focused app field. Enter submits forms, Tab moves focus, and Control+a/Meta+a selects text. Events are synthetic.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_select',
    description: 'Select app dropdown options by their value or label.',
    inputSchema: {
      type: 'object',
      properties: {
        selector,
        values: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['selector', 'values'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_wait_for_selector',
    description:
      'Wait for an element in the app iframe. Take a fresh snapshot after navigation.',
    inputSchema: {
      type: 'object',
      properties: {
        selector,
        state: {
          type: 'string',
          enum: ['visible', 'hidden', 'attached', 'detached'],
        },
        waitTimeoutMs: { type: 'integer', minimum: 1, maximum: 30000 },
      },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_get_text',
    description: 'Read text from an app preview element.',
    inputSchema: {
      type: 'object',
      properties: { selector },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_get_url',
    description: 'Get the current app iframe URL.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_open',
    description:
      'Navigate the selected app preview to a relative path or localhost URL on its current port. Other origins and ports are unavailable.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent_browser_reload',
    description:
      'Reload the live app through the AlmostNode service worker. Existing snapshot refs expire.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

function validate(name: string, args: Record<string, unknown>) {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error('Unknown iframe browser tool: ' + name);
  const schema = tool.inputSchema as {
    type: 'object';
    required?: string[];
    properties: Record<
      string,
      { type: string; enum?: unknown[]; minimum?: number; maximum?: number }
    >;
  };
  for (const key of schema.required ?? [])
    if (!(key in args)) throw new Error('Missing tool argument: ' + key);
  for (const [key, value] of Object.entries(args)) {
    const field = schema.properties[key];
    if (
      !field ||
      (field.type === 'integer'
        ? !Number.isInteger(value)
        : field.type === 'array'
          ? !Array.isArray(value) ||
            !value.length ||
            value.some((item) => typeof item !== 'string')
          : typeof value !== field.type)
    )
      throw new Error('Invalid tool argument: ' + key);
    if (field.enum && !field.enum.includes(value))
      throw new Error('Invalid tool argument: ' + key);
    if (
      typeof value === 'number' &&
      ((field.minimum !== undefined && value < field.minimum) ||
        (field.maximum !== undefined && value > field.maximum))
    )
      throw new Error('Tool argument out of range: ' + key);
  }
}

export interface OpenCodeBrowser {
  server: OpenCodeMcpServer;
  reset(): void;
  connect(options: {
    frame: HTMLIFrameElement;
    session: string;
    url: string;
    port: number;
    navigate?(path: string): void;
  }): () => void;
}

/** One MCP server follows the component's currently selected, isolated app iframe. */
export function createOpenCodeBrowser(
  settings: { onConnectedChange?(connected: boolean): void } = {},
): OpenCodeBrowser {
  let generation = 0;
  let navigation:
    | {
        generation: number;
        port: number;
        resolve(url: string): void;
        reject(error: Error): void;
      }
    | undefined;
  let target:
    | {
        call(
          tool: string,
          args: Record<string, unknown>,
          signal: AbortSignal,
        ): Promise<unknown>;
      }
    | undefined;
  return {
    reset() {
      target = undefined;
      navigation?.reject(new Error('The OpenCode session stopped.'));
    },
    server: {
      name: 'agent-browser',
      version: '1',
      instructions:
        'Control the live app preview with these Agent Browser-compatible iframe tools. They operate inside the currently selected AlmostNode app, never the terminal, host page or another browser tab. Start an app server before using them. Snapshot first, use its @refs for actions, and snapshot again to check the result. Refs expire after reload/navigation. Open only relative paths or localhost URLs on the selected port. This DOM adapter uses synthetic events; native CDP, screenshots and arbitrary browser tabs are not supported.',
      tools,
      async callTool(name, args, signal) {
        validate(name, args);
        if (!target)
          throw new Error(
            'No app preview is open. Start an HTTP server in this workspace, then use the browser tools.',
          );
        const result = await target.call(name, args, signal);
        return {
          content: [
            {
              type: 'text',
              text:
                typeof result === 'string' ? result : JSON.stringify(result),
            },
          ],
        };
      },
    },
    connect(options) {
      const revision = ++generation;
      settings.onConnectedChange?.(false);
      const origin = new URL(options.url).origin;
      const root = new URL('./__virtual__/' + options.port + '/', options.url);
      let currentUrl = root.href;
      let channel: MessagePort | undefined;
      let closed = false;
      let next = 0;
      const pending = new Map<
        number,
        { resolve(value: unknown): void; reject(error: Error): void }
      >();
      const waiting = new Set<{
        resolve(): void;
        reject(error: Error): void;
      }>();
      const rejectCalls = (reason: string) => {
        for (const call of pending.values()) call.reject(new Error(reason));
        pending.clear();
      };
      const ready = (signal: AbortSignal) => {
        if (closed)
          return Promise.reject(new Error('The app preview is closed.'));
        if (signal.aborted)
          return Promise.reject(new Error('Browser tool cancelled.'));
        if (channel) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          const finish = (error?: Error) => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            waiting.delete(entry);
            if (error) reject(error);
            else resolve();
          };
          const entry = {
            resolve: () => finish(),
            reject: (error: Error) => finish(error),
          };
          const abort = () => finish(new Error('Browser tool cancelled.'));
          const timer = setTimeout(
            () =>
              finish(
                new Error(
                  'The app browser bridge did not connect. Reload the preview; check that its HTML allows the injected browser script.',
                ),
              ),
            15000,
          );
          waiting.add(entry);
          signal.addEventListener('abort', abort, { once: true });
        });
      };
      const binding = {
        async call(
          tool: string,
          args: Record<string, unknown>,
          signal: AbortSignal,
        ) {
          if (closed) throw new Error('The app preview is closed.');
          if (signal.aborted) throw new Error('Browser tool cancelled.');
          if (
            tool === 'agent_browser_open' ||
            tool === 'agent_browser_reload'
          ) {
            let url =
              tool === 'agent_browser_reload'
                ? new URL(currentUrl)
                : new URL(String(args.url), currentUrl);
            if (
              ['localhost', '127.0.0.1', 'preview.internal'].includes(
                url.hostname,
              ) &&
              /^https?:$/.test(url.protocol) &&
              Number(url.port || (url.protocol === 'https:' ? 443 : 80)) ===
                options.port
            ) {
              url = new URL(
                root.pathname +
                  url.pathname.replace(/^\//, '') +
                  url.search +
                  url.hash,
                root,
              );
            }
            // Relative /path means the virtual app root, not the static worker origin.
            if (
              tool === 'agent_browser_open' &&
              String(args.url).startsWith('/') &&
              !String(args.url).startsWith('//')
            )
              url.pathname =
                root.pathname +
                new URL(String(args.url), root).pathname.replace(/^\//, '');
            if (
              url.origin !== root.origin ||
              !url.pathname.startsWith(root.pathname) ||
              url.username ||
              url.password
            )
              throw new Error(
                'Browser navigation is limited to the selected app port.',
              );
            if (!options.navigate)
              throw new Error(
                'The host must navigate through a fresh AlmostNode worker bootstrap.',
              );
            navigation?.reject(
              new Error('Another browser navigation started.'),
            );
            return new Promise<string>((resolve, reject) => {
              const finish = (error?: Error, value?: string) => {
                clearTimeout(timer);
                signal.removeEventListener('abort', abort);
                if (navigation === entry) navigation = undefined;
                if (error) reject(error);
                else resolve('Opened ' + value);
              };
              const abort = () => finish(new Error('Browser tool cancelled.'));
              const timer = setTimeout(
                () =>
                  finish(
                    new Error(
                      'The AlmostNode app did not reconnect after navigation.',
                    ),
                  ),
                20000,
              );
              const entry = {
                generation: revision,
                port: options.port,
                resolve: (value: string) => finish(undefined, value),
                reject: (error: Error) => finish(error),
              };
              navigation = entry;
              signal.addEventListener('abort', abort, { once: true });
              options.navigate?.(
                '/' +
                  url.pathname.slice(root.pathname.length) +
                  url.search +
                  url.hash,
              );
            });
          }
          await ready(signal);
          return new Promise<unknown>((resolve, reject) => {
            const id = ++next;
            const finish = (error?: Error, value?: unknown) => {
              clearTimeout(timer);
              signal.removeEventListener('abort', abort);
              pending.delete(id);
              if (error) reject(error);
              else resolve(value);
            };
            const abort = () => finish(new Error('Browser tool cancelled.'));
            const timer = setTimeout(
              () => finish(new Error('The app browser tool timed out.')),
              35000,
            );
            pending.set(id, {
              resolve: (value) => finish(undefined, value),
              reject: (error) => finish(error),
            });
            signal.addEventListener('abort', abort, { once: true });
            channel?.postMessage({ id, tool, args });
          });
        },
      };
      target = binding;
      const receive = (event: MessageEvent) => {
        if (
          closed ||
          event.source !== options.frame.contentWindow ||
          event.origin !== origin ||
          event.data?.type !== 'bl-opencode-browser:ready' ||
          event.data.session !== options.session
        )
          return;
        if (typeof event.data.url === 'string') {
          const url = new URL(event.data.url);
          if (
            url.origin !== root.origin ||
            !url.pathname.startsWith(root.pathname)
          )
            return;
          currentUrl = url.href;
        }
        channel?.close();
        rejectCalls('The app document changed. Take a new snapshot.');
        const ports = new MessageChannel();
        channel = ports.port1;
        channel.onmessage = (message: MessageEvent) => {
          const call = pending.get(message.data?.id);
          if (!call) return;
          if (typeof message.data.error === 'string')
            call.reject(new Error(message.data.error));
          else call.resolve(message.data.result);
        };
        channel.start();
        options.frame.contentWindow?.postMessage(
          { type: 'bl-opencode-browser:connect', session: options.session },
          origin,
          [ports.port2],
        );
        for (const entry of waiting) entry.resolve();
        waiting.clear();
        settings.onConnectedChange?.(true);
        if (navigation && navigation.generation < revision) {
          if (navigation.port === options.port) navigation.resolve(currentUrl);
          else
            navigation.reject(
              new Error('The selected app changed during navigation.'),
            );
        }
      };
      window.addEventListener('message', receive);
      return () => {
        closed = true;
        if (target === binding) target = undefined;
        settings.onConnectedChange?.(false);
        window.removeEventListener('message', receive);
        channel?.close();
        rejectCalls('The app preview was closed or replaced.');
        for (const entry of waiting)
          entry.reject(new Error('The app preview was closed or replaced.'));
        waiting.clear();
      };
    },
  };
}
