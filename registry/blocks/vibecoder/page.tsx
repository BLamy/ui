'use client';

import { useCallback, useRef, useState } from 'react';
import type { OpenCodeHostBridge } from '@/lib/open-code-host';
import { OpenCode, type OpenCodeProps } from '@/components/ui/open-code';
import { ThemeScope } from '@/lib/theme';
import { createVibecoderHost } from './host';

export interface VibecoderProps extends Omit<OpenCodeProps, 'autoStart'> {
  /** The app's URL base, e.g. `/ui`. Used by the default AlmostNode workspace. */
  basePath?: string;
}

/** OpenCode and a live app, ready as soon as this block mounts. */
export default function Vibecoder({
  host,
  createHost,
  basePath = '',
  title = 'Vibecoder',
  theme = 'dark',
  height = 720,
  style,
  onReady,
  onStateChange,
  ...props
}: VibecoderProps) {
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
      className="h-full min-h-0 w-full"
    >
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
        title={title}
        theme={theme}
        height={height}
        style={{ height: '100%', minHeight: 360, ...style }}
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
