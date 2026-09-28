import { afterEach, describe, expect, it, vi } from 'vitest';
import { fallbackSpans, normalizeSpans, type SyntaxSpan } from './syntax';

/** Label every span of `code` as [text, type] for readable assertions. */
const labels = (code: string, spans: SyntaxSpan[]) => spans.map((s) => [code.slice(s.start, s.end), s.type]);

/** A span covering the first occurrence of `text` (at or after `from`). */
const at = (code: string, text: string, type: SyntaxSpan['type'], from = 0): SyntaxSpan => {
  const start = code.indexOf(text, from);
  if (start < 0) throw new Error(`missing ${text}`);
  return { type, start, end: start + text.length };
};

const sortedAndDisjoint = (spans: SyntaxSpan[]) =>
  spans.every((s, i) => s.end > s.start && (i === 0 || spans[i - 1].end <= s.start));

describe('normalizeSpans', () => {
  it('relabels operators the GPU called keywords, keeping real keywords', () => {
    const code = 'const f = (a) => a?.b ?? c';
    const gpu: SyntaxSpan[] = [
      at(code, 'const', 'keyword'),
      at(code, 'f', 'function'),
      at(code, '=', 'operator'),
      at(code, '=>', 'keyword'),
      at(code, '?.', 'keyword'),
      at(code, '??', 'keyword'),
    ];
    const out = normalizeSpans(code, gpu);
    expect(labels(code, out)).toEqual([
      ['const', 'keyword'],
      ['f', 'function'],
      ['=', 'operator'],
      ['=>', 'operator'],
      ['?.', 'operator'],
      ['??', 'operator'],
    ]);
    expect(sortedAndDisjoint(out)).toBe(true);
  });

  it('splits mixed spans into word, operator, punctuation and whitespace runs', () => {
    const code = 'return (a) => { x.y ... z };';
    const out = normalizeSpans(code, [{ type: 'keyword', start: 0, end: code.length }]);
    expect(labels(code, out)).toEqual([
      ['return', 'keyword'],
      ['a', 'keyword'],
      ['=>', 'operator'],
      ['x', 'keyword'],
      ['y', 'keyword'],
      ['...', 'operator'],
      ['z', 'keyword'],
    ]);
    expect(sortedAndDisjoint(out)).toBe(true);
  });

  it('turns lone dots, colons and brackets plain but keeps multi-char operators', () => {
    const code = 'a.b: c::d -> e === f !== g && h || i';
    const out = normalizeSpans(code, [{ type: 'constant', start: 0, end: code.length }]);
    const ops = labels(code, out).filter(([, t]) => t === 'operator').map(([s]) => s);
    expect(ops).toEqual(['::', '->', '===', '!==', '&&', '||']);
    expect(labels(code, out).some(([s]) => s === '.' || s === ':')).toBe(false);
  });

  it('keeps identifier, decorator and directive characters with the word', () => {
    const code = '@Component #include $scope font-size --bl-gap';
    const spans = ['@Component', '#include', '$scope', 'font-size', '--bl-gap'].map((w) => at(code, w, 'type'));
    expect(labels(code, normalizeSpans(code, spans))).toEqual([
      ['@Component', 'type'],
      ['#include', 'type'],
      ['$scope', 'type'],
      ['font-size', 'type'],
      ['--bl-gap', 'type'],
    ]);
  });

  it('leaves comments, strings and numbers alone', () => {
    const code = '"a => b" // x => y\n1.5';
    const spans: SyntaxSpan[] = [at(code, '"a => b"', 'string'), at(code, '// x => y', 'comment'), at(code, '1.5', 'number')];
    expect(normalizeSpans(code, spans)).toEqual(spans);
  });

  it('sorts unsorted input and drops overlaps', () => {
    const code = 'let x = y';
    const out = normalizeSpans(code, [at(code, 'y', 'constant'), at(code, 'let', 'keyword'), { type: 'keyword', start: 1, end: 3 }]);
    expect(labels(code, out)).toEqual([
      ['let', 'keyword'],
      ['y', 'constant'],
    ]);
  });
});

describe('fallback lexer', () => {
  it('labels arrow, optional chaining and nullish operators; not lone dots', () => {
    const code = 'const f = (a) => a?.b ?? c.d';
    const out = normalizeSpans(code, fallbackSpans(code));
    const ops = labels(code, out).filter(([, t]) => t === 'operator').map(([s]) => s);
    expect(ops).toEqual(['=', '=>', '?.', '??']);
    expect(labels(code, out)[0]).toEqual(['const', 'keyword']);
    expect(labels(code, out).some(([s]) => s === '.' || s === '(' || s === ')')).toBe(false);
  });

  it('labels :: and ... but not a lone colon', () => {
    const code = 'std::vec x = { ...rest, key: 1 }';
    const ops = labels(code, fallbackSpans(code)).filter(([, t]) => t === 'operator').map(([s]) => s);
    expect(ops).toEqual(['::', '=', '...']);
  });
});

describe('probeWebGPU', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  const load = async (gpu: unknown) => {
    vi.resetModules();
    vi.stubGlobal('navigator', gpu === undefined ? {} : { gpu });
    return import('./syntax');
  };

  it('reports none without navigator.gpu, and the fallback engine is used', async () => {
    const m = await load(undefined);
    expect(await m.probeWebGPU()).toBe('none');
    expect(m.webgpuSupported()).toBe(false);
    expect((await m.lexSyntax('let a = 1')).highlighter).toBe('fallback');
  });

  it('reports none when there is no adapter', async () => {
    const m = await load({ requestAdapter: async () => null });
    expect(m.webgpuSupported()).toBe(true); // worth trying until the probe answers
    expect(await m.probeWebGPU()).toBe('none');
    expect(m.webgpuSupported('gpu')).toBe(false);
  });

  it('treats SwiftShader as software: auto falls back at once, gpu still may try', async () => {
    const m = await load({ requestAdapter: async () => ({ info: { vendor: 'google', architecture: 'swiftshader' } }) });
    expect(await m.probeWebGPU()).toBe('software');
    expect(m.webgpuSupported()).toBe(false);
    expect(m.webgpuSupported('gpu')).toBe(true);
    const r = await m.lexSyntax('const f = () => 1');
    expect(r.highlighter).toBe('fallback');
    expect(m.peekSyntax('const f = () => 1')).toBe(r);
  });

  it('treats isFallbackAdapter as software', async () => {
    const m = await load({ requestAdapter: async () => ({ isFallbackAdapter: true, info: { vendor: 'x' } }) });
    expect(await m.probeWebGPU()).toBe('software');
  });

  it('treats a named hardware adapter (Metal) as hardware', async () => {
    const m = await load({ requestAdapter: async () => ({ info: { vendor: 'apple', architecture: 'metal-3' } }) });
    expect(await m.probeWebGPU()).toBe('hardware');
    expect(m.webgpuSupported()).toBe(true);
  });

  it('times out to software, and a late hardware answer upgrades', async () => {
    vi.useFakeTimers();
    let answer!: (a: unknown) => void;
    const m = await load({ requestAdapter: () => new Promise((r) => (answer = r)) });
    const probe = m.probeWebGPU();
    await vi.advanceTimersByTimeAsync(2600);
    expect(await probe).toBe('software');
    expect(m.webgpuSupported()).toBe(false);
    answer({ info: { vendor: 'nvidia', architecture: 'ampere' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(m.webgpuSupported()).toBe(true);
  });
});
