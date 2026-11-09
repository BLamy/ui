import { createAgentWasmOpenCodeHost } from '@/lib/open-code-host';
import {
  html,
  css,
  script,
  server,
} from '@/components/blocks/vibecoder/project';

/** Each demo owns a fresh container; its public workspace path stays readable. */
export async function createDocsHost(basePath: string) {
  const { createContainer } = await import('@agent-wasm/core');
  const container = createContainer({ basePath: basePath.replace(/\/$/, '') });
  const host = createAgentWasmOpenCodeHost(container, {
    directory: '/workspaces/vibecoder-example',
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
