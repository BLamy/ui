/*!
 * gpu-query runtime — vendored from https://github.com/safzanpirani/gpu-query (site/src/runtime/, commit 41739a2).
 *
 * MIT License
 *
 * Copyright (c) 2026 Safzan Pirani
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changed from upstream (see ./README.md): the weights load lazily, so `parse` is async (`parseWith` is the
 * synchronous core); the compiler also reports the fragments it dropped; the WebGPU types are local; the explainer
 * film's traces and the demo's constants are gone.
 */

/**
 * parse(text, schema) -> filter clauses.
 *
 * The compiler is ported from spike/compile_query.py. It is the deterministic
 * half: the model proposes roles, and this code decides whether they form a
 * legal clause. A sequence that cannot is dropped rather than guessed at.
 *
 * The schema never enters the model. It enters the featurizer as identity-free
 * match rows, and it enters here.
 */

import { featurize } from "./featurize";
import * as gpu from "./webgpu";
import { argmax, forward } from "./model";
import { buildIndex, enumOwners, resolve, tokenize } from "./schema";
import { LABELS, loadWeights } from "./weights";
import type { Weights } from "./weights";
import type { Index, Match, Schema } from "./schema";

export { LABELS };
export type { Field, Kind, Schema } from "./schema";
export type { Weights } from "./weights";

export interface Clause {
  field: string;
  cmp: "eq" | "lt" | "gt" | "contains" | "is";
  value: string | true;
  neg: boolean;
}

export interface ParseResult {
  tokens: string[];
  roles: string[];
  scores: number[][];
  boundary: number[];
  resolved: Array<Match | null>;
  clauses: Clause[];
  /** The token range `[start, end)` each clause came from, parallel to `clauses`. */
  spans: Array<[number, number]>;
  /** Fragments the compiler could not turn into a clause (they carried field, value or operator roles). */
  dropped: string[];
  micros: number;
}

const COMPARISON_FOR_ROLE: Record<string, Clause["cmp"]> = {
  OP_EQ: "eq", OP_LT: "lt", OP_GT: "gt", OP_CONTAINS: "contains",
};
const CONJUNCTIONS = new Set(["AND", "OR"]);
const VALUE_ROLES = new Set(["VALUE", "VALUE_CONT"]);
const FIELD_ROLES = new Set(["FIELD", "FIELD_CONT"]);
/** Roles that mean the model heard something filter-like (as opposed to filler). */
const MEANINGFUL_ROLES = new Set([...VALUE_ROLES, ...FIELD_ROLES, ...Object.keys(COMPARISON_FOR_ROLE)]);

/** Added: extra places to start a clause when a phrase has no "and" between its parts. Off by default (upstream behaviour). */
export interface CompileOptions {
  /** Start a clause where the model's own boundary score is positive (it marks the first token of each clause). */
  boundary?: number[];
  /** Start a clause at a field token that names a different field than the clause so far, once that clause has a value. */
  splitOnFieldChange?: boolean;
}

function splitClauses(
  tokens: string[], roles: string[], index: Index, options: CompileOptions,
): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = 0;
  let field: string | null = null;
  let hasValue = false;
  const cut = (at: number) => {
    if (at > start) spans.push([start, at]);
    start = at;
    field = null;
    hasValue = false;
  };
  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];
    if (CONJUNCTIONS.has(role)) {
      cut(i);
      start = i + 1;
      continue;
    }
    if (options.boundary && options.boundary[i] > 0) cut(i);
    if (FIELD_ROLES.has(role)) {
      const found = resolve(tokens[i], index);
      if (found) {
        if (options.splitOnFieldChange && role === "FIELD" && field !== null && field !== found.field && hasValue) cut(i);
        if (field === null) field = found.field;
      }
    } else if (VALUE_ROLES.has(role)) hasValue = true;
  }
  if (start < roles.length) spans.push([start, roles.length]);
  return spans;
}

export function compile(
  tokens: string[], roles: string[], schema: Schema, options: CompileOptions = {},
): { clauses: Clause[]; dropped: string[]; spans: Array<[number, number]> } {
  const index = buildIndex(schema);
  const owners = enumOwners(schema);
  const byName = new Map(schema.map((f) => [f.name, f]));
  const clauses: Clause[] = [];
  const dropped: string[] = [];
  /** The token range [start, end) each clause came from, parallel to `clauses`. */
  const spans: Array<[number, number]> = [];

  for (const [start, end] of splitClauses(tokens, roles, index, options)) {
    let neg = false;
    let fieldName: string | null = null;
    let fieldKind: string | null = null;
    let comparison: Clause["cmp"] | null = null;
    const valueParts: string[] = [];

    for (let i = start; i < end; i++) {
      const role = roles[i];
      const token = tokens[i];
      if (role === "NEG") neg = true;
      else if (FIELD_ROLES.has(role) && fieldName === null) {
        const found = resolve(token, index);
        if (found) {
          fieldName = found.field;
          fieldKind = found.kind;
        }
      } else if (role in COMPARISON_FOR_ROLE && comparison === null) {
        comparison = COMPARISON_FOR_ROLE[role];
      } else if (VALUE_ROLES.has(role)) valueParts.push(token);
    }

    const drop = () => {
      const heard = tokens.slice(start, end).filter((_, i) => MEANINGFUL_ROLES.has(roles[start + i]));
      if (heard.length) dropped.push(heard.join(" "));
    };

    if (fieldName === null) {
      // A bare value names its own field when exactly one field owns it.
      const candidates = new Set<string>();
      for (const part of valueParts) {
        for (const owner of owners.get(part.toLowerCase()) ?? []) candidates.add(owner);
      }
      if (candidates.size !== 1) { drop(); continue; }
      fieldName = [...candidates][0];
      fieldKind = byName.get(fieldName)?.kind ?? null;
    }

    if (fieldKind === "bool" && valueParts.length === 0) {
      clauses.push({ field: fieldName, cmp: "is", value: true, neg });
      spans.push([start, end]);
      continue;
    }
    if (valueParts.length === 0) { drop(); continue; }

    clauses.push({
      field: fieldName,
      cmp: comparison ?? "eq",
      value: valueParts.join(" "),
      neg,
    });
    spans.push([start, end]);
  }

  return { clauses, dropped, spans };
}

/** Fetches and decodes the weights (~40 KB, once). Call early to warm the model; `parse` calls it anyway. */
export function loadModel(): Promise<Weights> {
  return loadWeights();
}

/**
 * The synchronous core: parse one phrase with weights from `loadModel()`. A single short phrase takes well under a
 * millisecond on the CPU. `segment` adds the two extra clause starts of `CompileOptions` (default: upstream's
 * AND/OR-only split).
 */
export function parseWith(model: Weights, text: string, schema: Schema, { segment = false }: { segment?: boolean } = {}): ParseResult {
  const started = performance.now();
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return {
      tokens: [], roles: [], scores: [], boundary: [], resolved: [],
      clauses: [], spans: [], dropped: [], micros: 0,
    };
  }

  const { rows, neighbors, resolved } = featurize(tokens, schema);
  const out = forward(model, rows, neighbors);
  const roles = out.logits.map((row) => LABELS[argmax(row)]);
  const { clauses, dropped, spans } = compile(tokens, roles, schema, segment ? { boundary: out.boundary, splitOnFieldChange: true } : {});

  return {
    tokens,
    roles,
    scores: out.logits,
    boundary: out.boundary,
    resolved,
    clauses,
    spans,
    dropped,
    micros: Math.round((performance.now() - started) * 1000),
  };
}

/** Parse one phrase against a schema (loads the weights on first use). */
export async function parse(text: string, schema: Schema): Promise<ParseResult> {
  return parseWith(await loadWeights(), text, schema);
}

export type Backend = "auto" | "cpu" | "webgpu";

/** WebGPU only repays its dispatch once there is a batch. gpu-time draws the
 *  same line at 32 inputs. Below it, the CPU path wins outright. */
export const GPU_THRESHOLD = 32;

export interface BatchResult {
  backend: "cpu" | "webgpu";
  millis: number;
  results: Array<{ tokens: string[]; roles: string[]; clauses: Clause[] }>;
}

export function gpuSupported(): boolean {
  return gpu.supported();
}

export async function warmGpu(): Promise<boolean> {
  return gpu.init(await loadWeights());
}

/** Parse many queries at once. This is the case the architecture is for. */
export async function parseBatch(
  texts: string[],
  schema: Schema,
  backend: Backend = "auto",
): Promise<BatchResult> {
  const model = await loadWeights();
  const prepared = texts.map((text) => {
    const tokens = tokenize(text);
    const { rows, neighbors } = featurize(tokens, schema);
    return { tokens, rows, neighbors };
  });

  const wantGpu =
    backend === "webgpu" ||
    (backend === "auto" && texts.length >= GPU_THRESHOLD && gpu.supported());

  const started = performance.now();

  if (wantGpu && (await gpu.init(model))) {
    const raw = await gpu.runBatch({
      rows: prepared.map((p) => p.rows),
      neighbors: prepared.map((p) => p.neighbors),
    });
    const results = prepared.map((p, i) => {
      const roles = raw[i].map((row) => LABELS[argmax(row.slice(0, LABELS.length))]);
      return { tokens: p.tokens, roles, clauses: compile(p.tokens, roles, schema).clauses };
    });
    return { backend: "webgpu", millis: performance.now() - started, results };
  }

  if (backend === "webgpu") throw new Error("WebGPU requested but unavailable");

  const results = prepared.map((p) => {
    const out = forward(model, p.rows, p.neighbors);
    const roles = out.logits.map((row) => LABELS[argmax(row)]);
    return { tokens: p.tokens, roles, clauses: compile(p.tokens, roles, schema).clauses };
  });
  return { backend: "cpu", millis: performance.now() - started, results };
}

/** Run the same inputs through both backends and report the worst drift.
 *  A kernel nobody checked is worse than no kernel. */
export async function checkBackends(
  texts: string[],
  schema: Schema,
): Promise<{ ok: boolean; maxLogitDelta: number; roleMismatches: number }> {
  const model = await loadWeights();
  const prepared = texts.map((text) => {
    const tokens = tokenize(text);
    return { tokens, ...featurize(tokens, schema) };
  });
  if (!(await gpu.init(model))) return { ok: false, maxLogitDelta: NaN, roleMismatches: -1 };

  const raw = await gpu.runBatch({
    rows: prepared.map((p) => p.rows),
    neighbors: prepared.map((p) => p.neighbors),
  });

  let maxLogitDelta = 0;
  let roleMismatches = 0;
  prepared.forEach((p, i) => {
    const cpu = forward(model, p.rows, p.neighbors);
    for (let t = 0; t < p.tokens.length; t++) {
      for (let r = 0; r < LABELS.length; r++) {
        maxLogitDelta = Math.max(maxLogitDelta, Math.abs(cpu.logits[t][r] - raw[i][t][r]));
      }
      maxLogitDelta = Math.max(
        maxLogitDelta, Math.abs(cpu.boundary[t] - raw[i][t][LABELS.length]),
      );
      const a = LABELS[argmax(cpu.logits[t])];
      const b = LABELS[argmax(raw[i][t].slice(0, LABELS.length))];
      if (a !== b) roleMismatches++;
    }
  });

  return { ok: roleMismatches === 0 && maxLogitDelta < 1e-3, maxLogitDelta, roleMismatches };
}
