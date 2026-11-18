/* @internal Why a sandbox could not do something. `lib/sandbox` exports it. */

export type SandboxErrorCode = 'isolation' | 'worker' | 'runtime' | 'files' | 'disposed';

export class SandboxError extends Error {
  /** `isolation`: the Worker could not be given an origin of its own (the message says what the host must serve).
   *  `worker`: the Worker you gave could not start. `runtime`: the runtime failed to start inside it. `files`: the disk
   *  refused a change. `disposed`: the sandbox is gone. */
  code: SandboxErrorCode;
  constructor(code: SandboxErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SandboxError';
    this.code = code;
  }
}

export const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));
