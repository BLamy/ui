import { describe, expect, it } from 'vitest';
import {
  clipString, copyTextOf, formatLength, fullLength, hiddenLength, nextShownLength, previewFromValue, previewText, previewTokens,
  type ValuePreview,
} from '@/lib/object-tree-value';

const str = (value: string): ValuePreview => ({ type: 'string', value });
const num = (value: number | string): ValuePreview => ({ type: 'number', value });
const text = (value: ValuePreview, options?: Parameters<typeof previewText>[1]) => previewText(value, options);

describe('previewText', () => {
  it.each<[string, ValuePreview, string]>([
    ['string', str('hi "there"\n'), '"hi \\"there\\"\\n"'],
    ['number', num(42), '42'],
    ['negative zero as a number', num(-0), '-0'],
    ['NaN as text', num('NaN'), 'NaN'],
    ['boolean', { type: 'boolean', value: false }, 'false'],
    ['null', { type: 'null' }, 'null'],
    ['undefined', { type: 'undefined' }, 'undefined'],
    ['bigint from digits', { type: 'bigint', value: '12' }, '12n'],
    ['bigint with its n', { type: 'bigint', value: '12n' }, '12n'],
    ['symbol', { type: 'symbol', value: 'Symbol(a)' }, 'Symbol(a)'],
    ['function', { type: 'function', name: 'f', params: 'a, b' }, 'ƒ f(a, b)'],
    ['anonymous function', { type: 'function' }, 'ƒ ()'],
    ['async function', { type: 'function', name: 'f', flavor: 'async' }, 'async ƒ f()'],
    ['generator', { type: 'function', name: 'g', flavor: 'generator' }, 'ƒ* g()'],
    ['async generator', { type: 'function', name: 'g', flavor: 'async generator' }, 'async ƒ* g()'],
    ['class', { type: 'function', name: 'Cart', flavor: 'class' }, 'class Cart'],
    ['object', { type: 'object', properties: [{ name: 'a', value: num(1) }, { name: 'b-c', value: str('x') }] }, '{a: 1, "b-c": "x"}'],
    ['named object', { type: 'object', className: 'Cart', properties: [{ name: 'a', value: num(1) }] }, 'Cart {a: 1}'],
    ['overflowing object', { type: 'object', properties: [{ name: 'a', value: num(1) }], overflow: true }, '{a: 1, …}'],
    ['object not read yet', { type: 'object', className: 'Window' }, 'Window'],
    ['plain object not read yet', { type: 'object' }, '{…}'],
    ['empty object', { type: 'object', properties: [] }, '{}'],
    ['array', { type: 'array', length: 2, items: [num(1), str('b')] }, '(2) [1, "b"]'],
    ['longer array than its preview', { type: 'array', length: 9, items: [num(1)] }, '(9) [1, …]'],
    ['array not read yet', { type: 'array', length: 9 }, 'Array(9)'],
    ['typed array', { type: 'array', className: 'Uint8Array', length: 1, items: [num(7)] }, 'Uint8Array(1) [7]'],
    ['empty array', { type: 'array', items: [] }, '[]'],
    ['map', { type: 'map', size: 1, entries: [{ key: str('a'), value: num(1) }] }, 'Map(1) {"a" => 1}'],
    ['map not read yet', { type: 'map', size: 3 }, 'Map(3)'],
    ['set', { type: 'set', size: 2, items: [num(1), num(2)] }, 'Set(2) {1, 2}'],
    ['set bigger than its preview', { type: 'set', size: 3, items: [num(1)] }, 'Set(3) {1, …}'],
    ['date', { type: 'date', value: '2026-11-03' }, '2026-11-03'],
    ['regexp', { type: 'regexp', value: '/a+/g' }, '/a+/g'],
    ['error', { type: 'error', name: 'TypeError', message: 'nope' }, 'TypeError: nope'],
    ['error with no message', { type: 'error' }, 'Error'],
    ['getter', { type: 'accessor' }, '(...)'],
    ['map entry', { type: 'entry', key: str('a'), value: { type: 'object', className: 'B' } }, '"a" => B'],
    ['unavailable', { type: 'unavailable' }, '<unavailable>'],
    ['unavailable with its own words', { type: 'unavailable', label: '<uninitialized>' }, '<uninitialized>'],
  ])('%s', (_, value, expected) => {
    expect(text(value)).toBe(expected);
  });

  it('keeps nested values to a word', () => {
    const value: ValuePreview = {
      type: 'object',
      properties: [
        { name: 'o', value: { type: 'object', properties: [{ name: 'x', value: num(1) }] } },
        { name: 'c', value: { type: 'object', className: 'C', properties: [{ name: 'x', value: num(1) }] } },
        { name: 'l', value: { type: 'array', length: 2, items: [num(1), num(2)] } },
        { name: 'm', value: { type: 'map', size: 1 } },
        { name: 'f', value: { type: 'function', name: 'f', params: 'a' } },
      ],
    };
    expect(text(value)).toBe('{o: {…}, c: C, l: Array(2), m: Map(1), f: ƒ}');
  });

  it('shows five properties and ten items, then an ellipsis', () => {
    const properties = Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, value: num(i) }));
    expect(text({ type: 'object', properties })).toBe('{p0: 0, p1: 1, p2: 2, p3: 3, p4: 4, …}');
    const items = Array.from({ length: 12 }, (_, i) => num(i));
    expect(text({ type: 'array', length: 12, items })).toBe('(12) [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, …]');
  });

  it('truncates long strings, at the top level and harder when nested', () => {
    const long = 'x'.repeat(250);
    expect(text(str(long))).toBe(`"${'x'.repeat(100)}…"`);
    expect(text(str(long), { maxString: 3 })).toBe('"xxx…"');
    const nested = text({ type: 'array', items: [str(long)] });
    expect(nested).toBe(`(1) ["${'x'.repeat(30)}…"]`);
  });

  it('never cuts an emoji in half', () => {
    expect(clipString('ab😀cd', 3)).toBe('ab');
    expect(clipString('ab😀cd', 4)).toBe('ab😀');
    expect(text(str('😀😀😀'), { maxString: 3 })).toBe('"😀…"');
  });

  it('leaves quotes off when asked, at the top level only', () => {
    expect(text(str('hello\nthere'), { quote: false })).toBe('hello\nthere');
    expect(text({ type: 'array', items: [str('a')] }, { quote: false })).toBe('(1) ["a"]');
  });

  it('tints each piece by what it is', () => {
    const tints = previewTokens({ type: 'object', className: 'A', properties: [{ name: 'k', value: str('v') }] }).map((t) => t.tint);
    expect(tints).toEqual(['className', 'punctuation', 'key', 'punctuation', 'string', 'punctuation']);
    expect(previewTokens(num(1))[0]!.tint).toBe('number');
    expect(previewTokens({ type: 'error' })[0]!.tint).toBe('error');
  });

  it('shows an error\'s stack only when expanded', () => {
    const value: ValuePreview = { type: 'error', name: 'E', message: 'm', stack: 'E: m\n  at f' };
    expect(text(value)).toBe('E: m');
    expect(text(value, { expanded: true })).toBe('E: m\n  at f');
  });

  it('keeps an error to one line, so it fits a row', () => {
    const value: ValuePreview = { type: 'error', name: 'E', message: 'first\nsecond' };
    expect(text(value)).toBe('E: first…');
    expect(text(value, { expanded: true })).toBe('E: first\nsecond');
    expect(hiddenLength(value, 100)).toBe(15);
    expect(hiddenLength(value, 100, true)).toBe(0);
  });
});

describe('copying and showing more', () => {
  it('copies a string as itself and an error as its stack', () => {
    expect(copyTextOf(str('a"b'))).toBe('a"b');
    expect(copyTextOf({ type: 'error', name: 'E', message: 'm', stack: 'E: m\n at f' })).toBe('E: m\n at f');
    expect(copyTextOf({ type: 'error', name: 'E', message: 'm' })).toBe('E: m');
    expect(copyTextOf(num(3))).toBe('3');
    expect(copyTextOf({ type: 'array', length: 1, items: [str('a')] })).toBe('(1) ["a"]');
  });

  it('counts what a Show more would reveal', () => {
    expect(hiddenLength(str('abcdef'), 4)).toBe(2);
    expect(hiddenLength(str('abc'), 4)).toBe(0);
    expect(hiddenLength(num(1), 0)).toBe(0);
    const error: ValuePreview = { type: 'error', name: 'E', message: 'm', stack: 'E: m\n  at f' };
    expect(hiddenLength(error, 100)).toBe(11);
    expect(hiddenLength(error, 100, true)).toBe(0);
    expect(hiddenLength({ type: 'error', name: 'E', message: 'm', stack: 'E: m' }, 100)).toBe(0);
  });

  it('shows more in steps', () => {
    expect(nextShownLength(5000, 100)).toBe(5000);
    expect(nextShownLength(5_000_000, 100)).toBe(65536);
    expect(nextShownLength(5_000_000, 65536)).toBe(655360);
    expect(nextShownLength(5_000_000, 655360)).toBe(5_000_000);
  });

  it('knows how much there is to read', () => {
    expect(fullLength(str('abc'))).toBe(3);
    expect(fullLength({ type: 'error', name: 'E', message: 'm', stack: 'E: m\n at f' })).toBe(10);
    expect(fullLength({ type: 'error', name: 'E', message: 'm' })).toBe(4);
    expect(fullLength(num(1))).toBe(0);
  });

  it('reads sizes', () => {
    expect(formatLength(812)).toBe('812 B');
    expect(formatLength(1234)).toBe('1.2 kB');
    expect(formatLength(3_400_000)).toBe('3.4 MB');
  });
});

describe('live values', () => {
  it.each<[string, unknown, string]>([
    ['a string', 'x', '"x"'],
    ['a number', 1.5, '1.5'],
    ['negative zero', -0, '-0'],
    ['NaN', Number.NaN, 'NaN'],
    ['true', true, 'true'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
    ['a bigint', 12n, '12n'],
    ['a symbol', Symbol('s'), 'Symbol(s)'],
    ['a date', new Date(Date.UTC(2026, 0, 2)), '2026-01-02T00:00:00.000Z'],
    ['an invalid date', new Date(Number.NaN), 'Invalid Date'],
    ['a regexp', /a+/g, '/a+/g'],
    ['an array', [1, 'b', {}, []], '(4) [1, "b", {…}, Array(0)]'],
    ['an empty array', [], '[]'],
    ['a typed array', new Uint8Array([1, 2]), 'Uint8Array(2) [1, 2]'],
    ['a map', new Map([['a', 1]]), 'Map(1) {"a" => 1}'],
    ['a set', new Set([1]), 'Set(1) {1}'],
    ['an object', { a: 1 }, '{a: 1}'],
    ['an instance', new (class Point { x = 1; })(), 'Point {x: 1}'],
    ['a null prototype', Object.assign(Object.create(null) as object, { a: 1 }), '{a: 1}'],
    ['a class', class Foo {}, 'class Foo'],
    ['an arrow', (a: number, b: number) => a + b, 'ƒ (a, b)'],
    ['a function', function named(a: number) { return a; }, 'ƒ named(a)'],
    ['an async function', async function later() { await Promise.resolve(); }, 'async ƒ later()'],
    ['a generator', function* gen() { yield 1; }, 'ƒ* gen()'],
  ])('describes %s', (_, value, expected) => {
    expect(previewText(previewFromValue(value))).toBe(expected);
  });

  it('describes an error', () => {
    const preview = previewFromValue(new RangeError('out'));
    expect(preview).toMatchObject({ type: 'error', name: 'RangeError', message: 'out' });
  });

  it('says a getter is one, without calling it', () => {
    let called = 0;
    const value = { get a() { called++; return 1; } };
    expect(previewText(previewFromValue(value))).toBe('{a: (...)}');
    expect(called).toBe(0);
  });
});
