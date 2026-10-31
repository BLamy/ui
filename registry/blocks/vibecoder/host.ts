import { createAgentWasmOpenCodeHost } from '@/lib/open-code-host';
import { html, css, script, server } from './project';

/** Creates and seeds the owned workspace before the terminal attaches. */
export async function createVibecoderHost(basePath = '') {
  const { createContainer } = await import('@agent-wasm/core');
  const container = createContainer({ basePath: basePath.replace(/\/$/, '') });
  const host = createAgentWasmOpenCodeHost(container, {
    disposeContainer: true,
  });
  try {
    for (const [name, content] of Object.entries({
      'index.html': html,
      'style.css': css,
      'app.js': script,
      'server.cjs': server,
    })) {
      host.workspaceBridge.writeFile(`${host.directory}/${name}`, content);
    }
    return host;
  } catch (error) {
    host.dispose?.();
    throw error;
  }
}
