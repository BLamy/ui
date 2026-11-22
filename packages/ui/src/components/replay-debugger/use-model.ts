'use client';
import { useSyncExternalStore } from 'react';
import type { DebuggerModel } from './model';

/** A piece of the model, and a render whenever that piece is different. */
export function useModel<T>(
  model: DebuggerModel,
  select: (model: DebuggerModel) => T,
): T {
  return useSyncExternalStore(model.subscribe, () => select(model));
}
