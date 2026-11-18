'use client';
/* ══ Sandbox for React ══
   `useSandbox(options)` makes one sandbox (lib/sandbox) for the component, starts it, follows its status, and disposes
   of it when the component goes. The sandbox is made in an effect, so nothing starts on a server, and it is started a
   moment later, so that Strict Mode's rehearsal disposes of the first one before it has started any Worker. ══ */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createSandbox, type Sandbox, type SandboxError, type SandboxIsolation, type SandboxOptions, type SandboxStatus } from '@/lib/sandbox';

export interface UseSandboxOptions extends SandboxOptions {
  /** Start it when the component mounts (the default). With `false`, call `sandbox.start()`, or run a command. */
  autoStart?: boolean;
}

export interface UseSandboxResult {
  /** `null` until the component has mounted, and on a server. */
  sandbox: Sandbox | null;
  status: SandboxStatus;
  /** Where the code runs: what the sandbox got. `null` until a Worker has started. */
  isolation: SandboxIsolation | null;
  error: SandboxError | null;
}

interface Snapshot {
  status: SandboxStatus;
  isolation: SandboxIsolation | null;
  error: SandboxError | null;
}
const IDLE: Snapshot = { status: 'idle', isolation: null, error: null };
const noop = () => () => {};

/** One sandbox for the component's life. The options are read once, when it mounts (change `key` for another sandbox),
 *  apart from the callbacks, `onHostFetch` and `onStatusChange`: each call goes to those of the latest render, so a gate
 *  that closes over state sees the state as it is now. */
export function useSandbox(options: UseSandboxOptions): UseSandboxResult {
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const first = useRef(options);
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  useEffect(() => {
    const { autoStart = true, onHostFetch: _onHostFetch, onStatusChange: _onStatusChange, ...rest } = first.current;
    const made = createSandbox({
      ...rest,
      onHostFetch: (request, details) => {
        const handler = latest.current.onHostFetch;
        return handler ? handler(request, details) : Promise.reject(new Error('This page answers no requests for the sandbox.'));
      },
      onStatusChange: (status, details) => latest.current.onStatusChange?.(status, details),
    });
    setSandbox(made);
    let gone = false;
    // A failed start is in `status` and `error`: nothing to do with the rejection here.
    if (autoStart) queueMicrotask(() => { if (!gone) made.start().catch(() => {}); });
    return () => {
      gone = true;
      made.dispose();
    };
  }, []);

  const snapshot = useRef(IDLE);
  const read = () => {
    if (!sandbox) return IDLE;
    const was = snapshot.current;
    if (was.status !== sandbox.status || was.isolation !== sandbox.isolation || was.error !== sandbox.error) {
      snapshot.current = { status: sandbox.status, isolation: sandbox.isolation, error: sandbox.error };
    }
    return snapshot.current;
  };
  const state = useSyncExternalStore(sandbox ? sandbox.subscribe : noop, read, () => IDLE);
  return { sandbox, ...state };
}
