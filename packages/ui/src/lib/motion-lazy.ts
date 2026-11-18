'use client';
/* @internal Motion on demand — the animation engine (framer-motion) arrives after first paint, once for the page.
   An everyday part (a Button's label, a List's rows, a chevron) draws its resting markup with no engine at all. When
   one that can animate mounts it asks for the engine at idle (`useMotionRequest`); the engine is `lib/motion-engine.ts`,
   one module behind one `import()`, so every part shares one chunk and one request. When a value changes:

     const engine = motionEngine();
     if (engine) engine.animate(el, { height }, springs.tray);   // here: animate as ever
     else { el.style.height = `${height}px`; requestMotionEngine(); }   // not yet: the change shows at once

   So before the engine has loaded a change simply applies, and nothing a part renders at rest depends on it: first
   paint, server rendering and hydration are the same with and without the chunk, and nothing renders again when it
   arrives. A layer that exists only while an animation runs (TextMorph's letters) is drawn with the engine's
   `m` elements; an element that is there at rest is a plain element the engine animates. Nothing here runs when
   the module is evaluated: the request starts from an effect or from a change. */
import { useEffect } from 'react';
import type * as Engine from '@/lib/motion-engine';

export type MotionEngine = typeof Engine;

let engine: MotionEngine | null = null;
let request: Promise<MotionEngine> | null = null;

/** Fetches the engine, once for the page, and resolves with it. A fetch that failed (offline, a stale deploy) is
 *  forgotten here, so a later call asks again; a browser keeps a failed module fetch for the life of the document,
 *  though, so the second ask usually fails the same way and the parts stay unanimated until the page is reloaded.
 *  Nothing breaks meanwhile: changes apply without animating. */
export function loadMotionEngine(): Promise<MotionEngine> {
  request ??= import('@/lib/motion-engine').then(
    (loaded) => {
      engine = loaded;
      return loaded;
    },
    (error: unknown) => {
      request = null;
      throw error;
    },
  );
  return request;
}

/** The engine if it has arrived, else null. Read it when an animation starts, not to decide what first paint draws. */
export function motionEngine(): MotionEngine | null {
  return engine;
}

/** Asks for the engine now, without waiting for it: for a change that found none, so the next one animates. Without
 *  the engine the kit works and nothing moves, so a failed fetch is not an error. */
export function requestMotionEngine(): void {
  loadMotionEngine().catch(() => undefined);
}

/* One idle callback for every part that is waiting, cancelled when the last of them unmounts first. */
let waiting = 0;
let cancelIdle: (() => void) | null = null;

function whenIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
  // No idle callbacks (Safari): after the frames a mount needs.
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
}

/** Asks for the engine once the browser is idle after mount (not on the first interaction), so it is here by the
 *  time a label changes or a row moves. `wanted: false` asks for nothing: a part that cannot animate as it is. */
export function useMotionRequest(wanted = true): void {
  useEffect(() => {
    if (!wanted || request) return;
    waiting++;
    cancelIdle ??= whenIdle(() => {
      cancelIdle = null;
      requestMotionEngine();
    });
    return () => {
      waiting--;
      if (waiting === 0 && cancelIdle) {
        cancelIdle();
        cancelIdle = null;
      }
    };
  }, [wanted]);
}
