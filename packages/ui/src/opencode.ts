'use client';

/* The OpenCode library, `@brett_lamy/ui/opencode`: the component, and its runtime (the loaders, the almost-node and
   agent-wasm hosts, the preview URL and the vault-backed stores). Written by hand, where the other libraries' entries
   are generated, because the runtime's modules have no entries of their own: they are large and load only when the
   component mounts. The component alone is also `@brett_lamy/ui/open-code`. */
export * from './components/open-code';
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
