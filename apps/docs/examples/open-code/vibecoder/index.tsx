import { useState } from 'react';
import { OpenCode } from '@/components/ui/open-code';
import {
  createAgentWasmOpenCodeHost,
  type OpenCodeHostBridge,
} from '@/lib/open-code-host';
import { html, css, script, server } from './project';

async function createHost() {
  const { createContainer } = await import('@agent-wasm/core');
  const container = createContainer({
    basePath: import.meta.env.BASE_URL.replace(/\/$/, ''),
  });
  const host = createAgentWasmOpenCodeHost(container, {
    disposeContainer: true,
  });
  for (const [name, content] of Object.entries({
    'index.html': html,
    'style.css': css,
    'app.js': script,
    'server.cjs': server,
  }))
    host.workspaceBridge.writeFile(`${host.directory}/${name}`, content);
  return host;
}

export default function Vibecoder() {
  const [host, setHost] = useState<OpenCodeHostBridge>();
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm text-secondary-label">
        Start OpenCode, then run the starter app. The preview opens
        automatically. Use Connection and /connect for AI replies.
      </p>
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-lg bg-tint px-4 py-2 text-white disabled:opacity-50"
          disabled={!host || running}
          onClick={async () => {
            if (!host) return;
            setRunning(true);
            setStatus('Starting app server…');
            try {
              const result = await host.processBridge.exec({
                command: 'node',
                args: ['server.cjs'],
                cwd: host.directory,
              });
              setStatus(
                result.stderr || result.stdout || `Exit ${result.code}`,
              );
            } catch (error) {
              setStatus(String(error));
              setRunning(false);
            }
          }}
        >
          Run starter app
        </button>
        <span role="status">{status}</span>
      </div>
      <OpenCode
        createHost={createHost}
        height={640}
        runtimeUrl={import.meta.env.VITE_OPENCODE_RUNTIME_URL}
        onReady={(_, readyHost) => setHost(readyHost)}
        onStateChange={(state) => {
          if (state !== 'running') {
            setHost(undefined);
            setRunning(false);
            setStatus('');
          }
        }}
      />
    </div>
  );
}
