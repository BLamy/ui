'use client';

/* OpenCode's runtime, on an entry of its own because it is large: the loaders, the almost-node and agent-wasm hosts,
   the preview URL and the vault-backed stores. The component is `@brett_lamy/ui/open-code` (and the root). */
export { DEFAULT_OPENCODE_PREVIEW_URL } from './lib/open-code-preview';
export {
  createAlmostNodeOpenCodeHost,
  createAgentWasmOpenCodeHost,
  loadOpenCodeRuntime,
  DEFAULT_OPENCODE_RUNTIME_URL,
} from './lib/open-code-host';
export type {
  OpenCodeHostBridge,
  OpenCodeCredentialStore,
  OpenCodeConnectionStore,
  OpenCodeKeychainStore,
  OpenCodePort,
  OpenCodeWorkspaceBridge,
  OpenCodeProcessBridge,
  OpenCodeCommand,
  OpenCodeMcpServer,
  OpenCodeRuntime,
  OpenCodeRuntimeSession,
  AlmostNodeOpenCodeContainer,
  AlmostNodeOpenCodeOptions,
} from './lib/open-code-host';

export {
  createVaultOpenCodeCredentialStore,
  createVaultOpenCodeConnectionStore,
  OPENCODE_CREDENTIAL_SLOT,
  OPENCODE_CONNECTION_SLOT,
} from './lib/open-code-keychain';
