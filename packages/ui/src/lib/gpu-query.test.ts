import { describe, expect, it } from 'vitest';
import blob from '@/lib/gpu-query/weights.json';
import { LABELS, checkBackends, gpuSupported, loadModel, parse, parseBatch, parseWith, warmGpu } from '@/lib/gpu-query';
import type { Clause, Schema } from '@/lib/gpu-query';
import logits from './__fixtures__/gpu-query-logits.json';
import parity from './__fixtures__/gpu-query-parity.json';

/* Smoke tests for the vendored gpu-query runtime. The fixtures are twenty phrases the upstream repo exported from its
   PyTorch checkpoint (parity.json): the roles and filters its TypeScript port must reproduce, and the logits for the
   first six. A fixture that drifts means the vendored port no longer matches the model it ships. */

interface Case { text: string; schema: Schema; labels: string[]; ast: Clause[] }
const cases = parity as unknown as Case[];

describe('the vendored runtime', () => {
  it('loads the weights lazily and agrees with the checkpoint', async () => {
    const model = await loadModel();
    expect(model.parameters).toBe(29597);
    expect(model.parameters).toBe(blob.parameters);
    expect(LABELS.join()).toBe(blob.labels.join());
    expect(model.order).toEqual(Object.keys(blob.tensors));
    expect(await loadModel()).toBe(model);
  });

  it.each(cases.map((c) => [c.text, c] as const))('%s', async (_text, c) => {
    const result = await parse(c.text, c.schema);
    expect(result.roles).toEqual(c.labels);
    expect(result.clauses).toEqual(c.ast);
  });

  it('keeps the checkpoint\'s own phrases intact with the optional segmentation on, and records where each clause came from', async () => {
    const model = await loadModel();
    for (const c of cases) {
      const result = parseWith(model, c.text, c.schema, { segment: true });
      expect(result.clauses).toEqual(c.ast);
      expect(result.spans).toHaveLength(result.clauses.length);
      for (const [start, end] of result.spans) expect(end).toBeGreaterThan(start);
    }
  });

  it('reproduces the PyTorch logits to quantisation noise', async () => {
    const model = await loadModel();
    for (const c of logits as unknown as Array<{ text: string; schema: Schema; logits: number[][]; boundary: number[] }>) {
      const result = parseWith(model, c.text, c.schema);
      result.scores.forEach((row, t) => row.forEach((x, r) => expect(Math.abs(x - c.logits[t][r])).toBeLessThan(0.02)));
      result.boundary.forEach((x, t) => expect(Math.abs(x - c.boundary[t])).toBeLessThan(0.02));
    }
  });

  it('returns nothing for an empty phrase', async () => {
    const result = await parse('  ', cases[0].schema);
    expect(result.clauses).toEqual([]);
    expect(result.tokens).toEqual([]);
  });

  it('reports the fragments it could not turn into a clause', async () => {
    const schema: Schema = [{ name: 'stage', kind: 'enum', aliases: [], values: ['qualified', 'won'] }];
    const result = await parse('stage qualified and zorp contains quux', schema);
    expect(result.clauses).toEqual([{ field: 'stage', cmp: 'eq', value: 'qualified', neg: false }]);
    expect(result.dropped.join(' ')).toContain('quux');
  });

  it('runs a batch on the CPU where there is no WebGPU', async () => {
    expect(gpuSupported()).toBe(false);
    expect(await warmGpu()).toBe(false);
    const batch = await parseBatch(cases.map((c) => c.text).slice(0, 3), cases[0].schema);
    expect(batch.backend).toBe('cpu');
    expect(batch.results).toHaveLength(3);
    await expect(parseBatch(['x'], cases[0].schema, 'webgpu')).rejects.toThrow(/WebGPU/);
    expect((await checkBackends(['x'], cases[0].schema)).ok).toBe(false);
  });
});
