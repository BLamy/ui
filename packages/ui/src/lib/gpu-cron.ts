'use client';
import { useEffect, useState } from 'react';
import type { CronMatch } from 'gpu-cron';

/* Natural language → cron, by gpu-cron: an 89 KB WebGPU model (45k parameters) that turns "every weekday at 9am" into
   `0 9 * * 1-5`. It needs WebGPU — there is no CPU fallback — so everything here is built around asking first:

     - `gpuCronAvailable()` resolves false, without downloading the package, when the browser has no `navigator.gpu`,
       and otherwise loads gpu-cron (dynamic `import()`, once) and asks it. Nothing runs at module scope (SSR-safe).
     - `useCronParse` returns `supported: null` until that is known, then true or false; it never parses when
       unsupported, so the caller can hide the natural-language box and fall back to typing the expression.

   What the model returns is always a syntactically valid 5-field cron expression, but it has no way to say "I did not
   understand": gibberish gets a confident, valid, meaningless answer (and sub-minute or end-of-month requests are
   known to come out wrong). Always show the decoded expression next to what was typed. The `next` times it returns
   are in the machine's local zone and cannot be changed; use `nextCronRuns` from `lib/cron` for any zone. */

export type { CronMatch as GpuCronMatch };

type GpuCronModule = typeof import('gpu-cron');

let modulePromise: Promise<GpuCronModule> | null = null;
let availablePromise: Promise<boolean> | null = null;
let known: boolean | null = null;

/** Whether the browser exposes WebGPU at all (`navigator.gpu`). False on the server. A cheap, synchronous hint:
    it does not mean an adapter exists. */
export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/** Loads gpu-cron (once; cached, and a failed load is retried by the next call). */
export function loadGpuCron(): Promise<GpuCronModule> {
  return (modulePromise ??= import('gpu-cron').catch((error: unknown) => {
    modulePromise = null;
    throw error;
  }));
}

/** Whether the model can run here. Resolves false (never rejects) without loading the package when there is no
    `navigator.gpu`; otherwise loads it and asks `isAvailable()`, which also uploads the weights so the first parse is
    warm. The answer is cached. */
export function gpuCronAvailable(): Promise<boolean> {
  return (availablePromise ??= (hasWebGPU() ? loadGpuCron().then((m) => m.isAvailable()) : Promise.resolve(false))
    .catch(() => false)
    .then((ok) => (known = ok)));
}

/** The cached answer of `gpuCronAvailable()` if it has resolved, else null. */
export function peekGpuCronAvailable(): boolean | null {
  return known;
}

/** Parses `text` into a cron expression and its next fire times (local zone). Rejects when the model cannot run
    (no WebGPU) or the text is too long for it. Never rejects for nonsense: see the note at the top. */
export async function parseCronText(text: string, { count = 5 }: { count?: number } = {}): Promise<CronMatch> {
  const m = await loadGpuCron();
  return m.parse(text.trim(), { count });
}

/** A short message for an error from the model, for showing next to the input. */
export function describeCronError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/webgpu|adapter/i.test(message)) return 'Describing a schedule needs WebGPU, which is not available here.';
  if (/characters|fits/i.test(message)) return 'That description is too long. Shorten it, or type the expression below.';
  return 'The model could not read that. Try rephrasing, or type the expression below.';
}

/** Forgets the loaded module and the availability answer. For tests and hot reload. */
export function resetGpuCron(): void {
  modulePromise = null;
  availablePromise = null;
  known = null;
}

/* ── The hook ── */

export interface UseCronParseOptions {
  /** How many upcoming fire times the model returns (they are in the local zone). Default: 5. */
  count?: number;
  /** Milliseconds to wait after the last change before parsing. The model serialises calls, so one per keystroke is
      safe, but debouncing saves work. Default: 150. */
  debounceMs?: number;
  /** Pause everything, including the availability check. Default: true. */
  enabled?: boolean;
}

export interface CronParseState {
  /** The latest settled answer. While `pending` it is the answer to the previous text: compare `parsedText`. */
  result: CronMatch | null;
  /** Why the latest parse failed, or null. */
  error: Error | null;
  /** True from a change of text until the parse for it settles. */
  pending: boolean;
  /** Whether the model can run: null until known (and while disabled), then true or false. */
  supported: boolean | null;
  /** The text `result` / `error` belong to, or null. */
  parsedText: string | null;
}

interface Settled {
  text: string;
  count: number;
  result: CronMatch | null;
  error: Error | null;
}

/** Parses a description as you type, on the GPU: checks support first (and says so with `supported`), debounces,
    drops out-of-order answers and cleans up on unmount. Empty text is "nothing to parse". Remember the model always
    answers: show `result.expression` for the person to check.

    const { result, supported } = useCronParse(text)   // supported === false → hide the box */
export function useCronParse(text: string, { count = 5, debounceMs = 150, enabled = true }: UseCronParseOptions = {}): CronParseState {
  const [supported, setSupported] = useState<boolean | null>(() => peekGpuCronAvailable());
  const [settled, setSettled] = useState<Settled | null>(null);
  const trimmed = text.trim();
  const active = enabled && supported === true && trimmed !== '';

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void gpuCronAvailable().then((ok) => {
      if (live) setSupported(ok);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!active) {
      setSettled(null);
      return;
    }
    // One generation per run of the effect: its cleanup silences it, so a slow answer to old input is dropped.
    let live = true;
    const timer = setTimeout(() => {
      parseCronText(text, { count }).then(
        (result) => {
          if (live) setSettled({ text, count, result, error: null });
        },
        (reason: unknown) => {
          if (live) setSettled({ text, count, result: null, error: reason instanceof Error ? reason : new Error(String(reason)) });
        },
      );
    }, debounceMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, text, count, debounceMs]);

  if (!active) return { result: null, error: null, pending: false, supported: enabled ? supported : null, parsedText: null };
  return {
    result: settled?.result ?? null,
    error: settled?.error ?? null,
    pending: !settled || settled.text !== text || settled.count !== count,
    supported,
    parsedText: settled?.text ?? null,
  };
}
