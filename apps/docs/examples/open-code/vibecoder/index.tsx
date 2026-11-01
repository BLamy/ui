import VibecoderBlock from '@/components/blocks/vibecoder/page';
import { useCallback, useRef, useState } from 'react';
import { loadOpenCodeRuntime, type OpenCodeMcpServer, type OpenCodeRuntime } from '@/lib/open-code-host';

export default function Vibecoder() {
  const browser = useRef<OpenCodeMcpServer | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('Test the live iframe without signing in to a model.');
  const loadRuntime = useCallback(async () => {
    const runtime = await loadOpenCodeRuntime(import.meta.env.VITE_OPENCODE_RUNTIME_URL);
    return {
      ...runtime,
      async mount(options: Parameters<OpenCodeRuntime['mount']>[0]) {
        browser.current = options.mcpServers?.find((server) => server.name === 'agent-browser');
        return runtime.mount(options);
      },
    };
  }, []);
  const test = async () => {
    if (!browser.current) return;
    setBusy(true);
    setResult('Checking snapshot → click → navigate → reload…');
    const server = browser.current;
    const signal = AbortSignal.timeout(60000);
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const reply = await server.callTool(name, args, signal);
      const text = reply.content.map((part) => part.text).join('\n');
      if (reply.isError) throw new Error(text);
      return text;
    };
    try {
      const snapshot = await call('agent_browser_snapshot');
      const counter = /button "Clicked (\d+) times" \[ref=(e\d+)\]/.exec(snapshot);
      if (!counter) throw new Error('The starter counter is missing from the app snapshot.');
      await call('agent_browser_click', { selector: '@' + counter[2] });
      const text = await call('agent_browser_get_text', { selector: '@' + counter[2] });
      if (text !== `Clicked ${Number(counter[1]) + 1} times`) throw new Error('The browser click did not update the app.');
      await call('agent_browser_open', { url: 'http://localhost:3000/?mcp-test=1' });
      if (!(await call('agent_browser_get_url')).includes('?mcp-test=1')) throw new Error('The app navigation did not reach its target.');
      await call('agent_browser_reload');
      await call('agent_browser_wait_for_selector', { selector: 'button', state: 'visible' });
      const reloaded = await call('agent_browser_snapshot');
      if (!reloaded.includes('button "Clicked 0 times"')) throw new Error('The app did not reconnect after reload.');
      setResult('Passed: the iframe tools read the app, clicked its counter, verified the change, navigated, and reconnected after reload.');
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <VibecoderBlock
          basePath={import.meta.env.BASE_URL}
          loadRuntime={loadRuntime}
          onStateChange={(state) => setReady(state === 'running')}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-2 pb-2 text-xs">
        <button type="button" disabled={!ready || busy} onClick={() => void test()} className="appearance-none rounded border border-border bg-background px-3 py-2 text-foreground disabled:opacity-50">
          {busy ? 'Testing browser tools…' : 'Test browser tools'}
        </button>
        <output className="min-w-0 flex-1 text-muted-foreground" aria-live="polite">{result}</output>
      </div>
    </div>
  );
}
