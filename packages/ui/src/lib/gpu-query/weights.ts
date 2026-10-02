/*! Vendored from safzanpirani/gpu-query (MIT, © 2026 Safzan Pirani), site/src/runtime/weights.ts @ 41739a2.
    Changed: the weights are loaded lazily (dynamic import of ./weights.json) instead of decoded at module load. See ./README.md and ./LICENSE. */

/**
 * Decoded model weights, shared by the CPU and WebGPU backends.
 *
 * Stored as int6 values in int8 with one scale per tensor, which is the
 * quantisation the model trained under. The JSON (~40 KB) is imported on first
 * use, so an app that never parses a phrase never downloads it.
 */

import { FEATURE_ROWS } from './featurize';

export const HIDDEN = 32;

/** The twelve roles the tagger emits, in the order of its output columns. */
export const LABELS = [
  'O', 'FIELD', 'FIELD_CONT', 'OP_EQ', 'OP_LT', 'OP_GT', 'OP_CONTAINS', 'VALUE', 'VALUE_CONT', 'NEG', 'AND', 'OR',
] as const;

interface Packed { shape: number[]; scale: number; data: string }
interface Blob {
  featureRows: number; hidden: number; slots: number; labels: string[];
  parameters: number; bits: number; transferExactAst: number;
  tensors: Record<string, Packed>;
}

/** The decoded model: every tensor as floats, in a fixed order, plus the checkpoint's metadata. */
export interface Weights {
  /** Tensor names in blob order, so the GPU weight buffer packs identically every run. */
  order: string[];
  tensors: Record<string, Float32Array>;
  parameters: number;
  /** Exact-filter accuracy the checkpoint's author measured on his own generated transfer corpus. */
  transferExactAst: number;
}

function decode(packed: Packed): Float32Array {
  const binary = atob(packed.data);
  const out = new Float32Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    // int8 two's complement, then the tensor scale.
    out[i] = ((binary.charCodeAt(i) << 24) >> 24) * packed.scale;
  }
  return out;
}

function fromBlob(blob: Blob): Weights {
  // The checkpoint, the label set and the feature layout must agree, or the model is scored against the wrong rows.
  if (blob.featureRows !== FEATURE_ROWS || blob.labels.join() !== LABELS.join()) {
    throw new Error('gpu-query: weights.json does not match the featurizer or the label set');
  }
  const order = Object.keys(blob.tensors);
  const tensors: Record<string, Float32Array> = {};
  for (const name of order) tensors[name] = decode(blob.tensors[name]);
  return { order, tensors, parameters: blob.parameters, transferExactAst: blob.transferExactAst };
}

let pending: Promise<Weights> | null = null;

/** Fetches and decodes the weights once; every caller shares the same promise (a failed load can be retried). */
export function loadWeights(): Promise<Weights> {
  pending ??= import('./weights.json')
    .then((mod) => fromBlob(mod.default as unknown as Blob))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
