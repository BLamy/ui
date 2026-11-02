'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { OpenCodeHostBridge } from '@/lib/open-code-host';
import { OpenCode, type OpenCodeProps } from '@/components/ui/open-code';
import { ThemeScope } from '@/lib/theme';
import { createVibecoderHost } from './host';
import {
  PasswordsKeychain,
  usePasswordsKeychain,
} from '../apple-passwords/page';
import {
  createVaultOpenCodeCredentialStore,
  createVaultOpenCodeConnectionStore,
} from '@/lib/open-code-keychain';

export interface VibecoderProps extends Omit<OpenCodeProps, 'autoStart'> {
  /** The app's URL base, e.g. `/ui`. Used by the default AlmostNode workspace. */
  basePath?: string;
}

/** OpenCode and a live app, ready as soon as this block mounts. */
export default function Vibecoder(props: VibecoderProps) {
  return (
    <PasswordsKeychain
      tailscale={false}
      protects="OpenCode provider sign-ins and your Tailscale session"
    >
      <Workspace {...props} />
    </PasswordsKeychain>
  );
}

function Workspace({
  host,
  createHost,
  credentialStore,
  connectionStore,
  basePath = '',
  title = 'Vibecoder',
  theme = 'dark',
  height = 720,
  style,
  onReady,
  onStateChange,
  ...props
}: VibecoderProps) {
  const keychain = usePasswordsKeychain();
  const vault = keychain?.vault;
  const stores = useMemo(
    () =>
      vault
        ? {
            credentials: createVaultOpenCodeCredentialStore(vault),
            connection: createVaultOpenCodeConnectionStore(vault),
          }
        : undefined,
    [vault],
  );
  const createStarter = useCallback(
    () => createVibecoderHost(basePath),
    [basePath],
  );
  const current = useRef<OpenCodeHostBridge | undefined>(undefined);
  const [error, setError] = useState('');
  return (
    <ThemeScope
      scope="terminal"
      appearance={theme}
      className="flex h-full min-h-0 w-full flex-col"
    >
      {keychain && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 px-3 py-2 text-sm">
          <button
            type="button"
            className="rounded-lg border border-separator px-3 py-2 disabled:opacity-50"
            disabled={
              vault?.status === 'loading' || vault?.status === 'unsupported'
            }
            onClick={() =>
              vault?.status === 'unlocked'
                ? vault.lock()
                : keychain.requestUnlock()
            }
          >
            {vault?.status === 'unlocked'
              ? 'Lock Passwords keychain'
              : vault?.status === 'empty'
                ? 'Set up Passwords keychain'
                : 'Unlock Passwords keychain'}
          </button>
          <span className="text-xs text-secondary-label">
            {vault?.status === 'unlocked'
              ? 'Connections saved in Passwords'
              : vault?.status === 'unsupported'
                ? 'Encrypted keychain unavailable in this browser'
                : 'Unlock Passwords to restore Tailscale and provider sign-ins'}
          </span>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 bg-muted px-3 py-2 text-sm text-foreground"
        >
          {error}
        </p>
      )}
      <OpenCode
        {...props}
        credentialStore={credentialStore ?? stores?.credentials}
        connectionStore={connectionStore ?? stores?.connection}
        title={title}
        theme={theme}
        height={height}
        style={{ flex: 1, minHeight: 360, ...style }}
        host={host}
        createHost={createHost ?? (host ? undefined : createStarter)}
        autoStart
        onReady={(session, readyHost) => {
          current.current = readyHost;
          if (!host && !createHost && readyHost) {
            void readyHost.processBridge
              .exec({
                command: 'node',
                args: ['server.cjs'],
                cwd: readyHost.directory,
              })
              .then(
                (result) => {
                  if (current.current === readyHost && result.code !== 0)
                    setError(
                      result.stderr ||
                        `The starter app exited with code ${result.code}.`,
                    );
                },
                (reason: unknown) => {
                  if (current.current === readyHost)
                    setError(
                      reason instanceof Error ? reason.message : String(reason),
                    );
                },
              );
          }
          onReady?.(session, readyHost);
        }}
        onStateChange={(state) => {
          if (state !== 'running') {
            current.current = undefined;
            setError('');
          }
          onStateChange?.(state);
        }}
      />
    </ThemeScope>
  );
}
