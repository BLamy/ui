/* OpenCode owns a browser workspace for the lifetime of its terminal session. The desktop keeps this app mounted
   while minimized; closing the window unmounts OpenCode, which disposes both the terminal and its container. */
import { useMemo, useRef, useState } from 'react';
import { OpenCode } from '@/components/ui/open-code';
import { createAgentWasmOpenCodeHost, type OpenCodeHostBridge } from '@/lib/open-code-host';
import { createVaultOpenCodeCredentialStore } from '@/lib/open-code-keychain';
import { useOptionalTailscale } from '@/lib/tailscale-react';
import { PasswordsKeychain, usePasswordsKeychain } from '../apple-passwords/page';
import { ThemeScope } from '@/lib/theme';

const STARTER_BACKGROUND = '#18181b';
const STARTER_FOREGROUND = '#fafafa';
const STARTER_SECONDARY = '#a1a1aa';

const STARTER_FILES = {
  'index.html': `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenCode workspace</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${STARTER_BACKGROUND}; color: ${STARTER_FOREGROUND}; font: 16px/1.6 system-ui; }
  main { max-width: 360px; padding: 32px; }
  h1 { font-size: 36px; line-height: 1.1; letter-spacing: -.04em; }
  p { color: ${STARTER_SECONDARY}; }
  button { border: 0; border-radius: 8px; padding: 12px 20px; font: inherit; cursor: pointer; }
</style>
<main>
  <h1>Your OpenCode workspace.</h1>
  <p>Edit index.html in the terminal, then reload this preview to see your changes.</p>
  <button id="count">Clicked 0 times</button>
</main>
<script>
  let count = 0;
  document.querySelector('#count').onclick = event => { event.target.textContent = 'Clicked ' + (++count) + ' times'; };
</script>
</html>`,
  'server.cjs': `const http = require('http');
const fs = require('fs');
http.createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(fs.readFileSync('index.html'));
}).listen(3000, '0.0.0.0');
console.log('Starter app listening on port 3000');`,
};

async function createHost() {
  const { createContainer } = await import('@agent-wasm/core');
  const container = createContainer({ basePath: import.meta.env.BASE_URL.replace(/\/$/, '') });
  const host = createAgentWasmOpenCodeHost(container, { disposeContainer: true });
  try {
    for (const [name, content] of Object.entries(STARTER_FILES))
      host.workspaceBridge.writeFile(`${host.directory}/${name}`, content);
    return host;
  } catch (error) {
    host.dispose?.();
    throw error;
  }
}

export default function OpenCodeApp() {
  const tailscale = useOptionalTailscale();
  return <PasswordsKeychain tailscale={tailscale ?? false} protects="OpenCode provider sign-ins"><OpenCodeWorkspace /></PasswordsKeychain>;
}

function OpenCodeWorkspace() {
  const keychain = usePasswordsKeychain();
  const vault = keychain?.vault;
  const credentialStore = useMemo(() => vault ? createVaultOpenCodeCredentialStore(vault) : undefined, [vault]);
  const [host, setHost] = useState<OpenCodeHostBridge>();
  const currentHost = useRef(host);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');

  async function runStarter() {
    if (!host || running) return;
    const workspace = host;
    setRunning(true);
    setStatus('Starting app server…');
    try {
      const result = await workspace.processBridge.exec({ command: 'node', args: ['server.cjs'], cwd: workspace.directory });
      if (currentHost.current !== workspace) return;
      setStatus(result.stderr || result.stdout || `Exit ${result.code}`);
      if (result.code !== 0) setRunning(false);
    } catch (error) {
      if (currentHost.current !== workspace) return;
      setStatus(error instanceof Error ? error.message : String(error));
      setRunning(false);
    }
  }

  return (
    <ThemeScope scope="terminal" className="flex h-full min-h-0 flex-col overflow-auto bg-background text-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-separator px-3 py-2 text-xs">
        {keychain && <>
          <button type="button" className="rounded-md border border-separator px-3 py-1.5 disabled:opacity-50"
            disabled={vault?.status === 'loading' || vault?.status === 'unsupported'}
            onClick={() => vault?.status === 'unlocked' ? vault.lock() : keychain.requestUnlock()}>
            {vault?.status === 'unlocked' ? 'Lock Passwords keychain' : vault?.status === 'empty' ? 'Set up Passwords keychain' : 'Unlock Passwords keychain'}
          </button>
          <span className="text-secondary-label">{vault?.status === 'unlocked' ? 'Encrypted saving enabled · Start OpenCode to load saved sign-ins' : vault?.status === 'unsupported' ? 'Encrypted keychain unavailable in this browser' : 'Unlock Passwords to save provider sign-ins'}</span>
        </>}
        <button
          type="button"
          className="rounded-md border border-separator px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-tint disabled:opacity-50"
          disabled={!host || running}
          onClick={runStarter}
        >
          Run starter app
        </button>
        <span role="status" className="text-secondary-label">
          {status || 'Start OpenCode to edit files and preview an app. No provider needed for the starter.'}
        </span>
      </div>
      <OpenCode
        autoStart={false}
        createHost={createHost}
        credentialStore={credentialStore}
        className="min-h-[360px] flex-1 rounded-none border-0"
        style={{ height: 'auto' }}
        runtimeUrl={import.meta.env.VITE_OPENCODE_RUNTIME_URL}
        onReady={(_, readyHost) => {
          currentHost.current = readyHost;
          setHost(readyHost);
        }}
        onStateChange={(state) => {
          if (state !== 'running') {
            currentHost.current = undefined;
            setHost(undefined);
            setRunning(false);
            setStatus('');
          }
        }}
      />
    </ThemeScope>
  );
}
