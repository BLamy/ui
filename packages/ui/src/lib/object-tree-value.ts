/* ══ Values described as data, and the text a preview shows: what ObjectValue draws. No React in here, and nothing
   about trees, so a console row can use it alone. ══ */

/* ── Values ── */

/** A named value inside an object's one-line preview. */
export interface ValueProperty {
  name: string;
  value: ValuePreview;
}

/** A key and value inside a map's one-line preview. */
export interface ValueMapEntry {
  key: ValuePreview;
  value: ValuePreview;
}

/** What a value is and what to show for it. Plain data, so it can arrive from anywhere: another process, a recording,
 *  a server. `previewFromValue` makes one from a live JavaScript value. */
export type ValuePreview =
  | { type: 'string'; value: string }
  /** A string for what JSON can't carry: `NaN`, `-0`, `Infinity`. */
  | { type: 'number'; value: number | string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }
  /** Digits; a trailing `n` is added if it isn't there. */
  | { type: 'bigint'; value: bigint | string }
  /** The text to show, as `Symbol(id)`. */
  | { type: 'symbol'; value: string }
  | { type: 'function'; name?: string; params?: string; flavor?: 'async' | 'generator' | 'async generator' | 'class' }
  /** `properties` is what the preview knows, not all there is: `overflow` says more exist. */
  | { type: 'object'; className?: string; properties?: readonly ValueProperty[]; overflow?: boolean }
  /** Also typed arrays, with their `className`. */
  | { type: 'array'; className?: string; length?: number; items?: readonly ValuePreview[]; overflow?: boolean }
  | { type: 'map'; className?: string; size?: number; entries?: readonly ValueMapEntry[]; overflow?: boolean }
  | { type: 'set'; className?: string; size?: number; items?: readonly ValuePreview[]; overflow?: boolean }
  /** The text to show. */
  | { type: 'date'; value: string }
  /** The text to show, as `/a+/g`. */
  | { type: 'regexp'; value: string }
  | { type: 'error'; name?: string; message?: string; stack?: string }
  /** A getter or accessor nobody has called: `(...)`. */
  | { type: 'accessor' }
  /** One entry of a map, `key => value`. */
  | { type: 'entry'; key: ValuePreview; value: ValuePreview }
  /** A value that can't be read: `<unavailable>`, or your own `label`, as `<uninitialized>`. */
  | { type: 'unavailable'; label?: string };

export type ValueType = ValuePreview['type'];

/** How a piece of a preview is tinted. */
export type ValueTint =
  | 'string' | 'number' | 'keyword' | 'nullish' | 'function' | 'functionMark' | 'symbol' | 'regexp' | 'date' | 'error'
  | 'className' | 'key' | 'punctuation' | 'muted' | 'plain';

/** One tinted run of a preview's text. */
export interface ValueToken {
  text: string;
  tint: ValueTint;
}

/** Characters of a string a preview shows before truncating it. */
export const STRING_PREVIEW_LENGTH = 100;
const NESTED_STRING_LENGTH = 30;
const OBJECT_PREVIEW_ENTRIES = 5;
const LIST_PREVIEW_ENTRIES = 10;
const ELLIPSIS = '…';

const IDENTIFIER = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

/** A string cut to at most `max` characters, never through the middle of an emoji. */
export function clipString(text: string, max: number): string {
  if (text.length <= max) return text;
  const code = text.charCodeAt(max - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

export interface ValuePreviewOptions {
  /** Characters of a string to show. Default `STRING_PREVIEW_LENGTH`. */
  maxString?: number;
  /** Quote strings, as a value. `false` for the bare text a console shows for a top-level string. Default `true`. */
  quote?: boolean;
  /** Show an error's stack rather than its one-line message. */
  expanded?: boolean;
}

function stringTokens(text: string, max: number, quote: boolean): ValueToken[] {
  const shown = clipString(text, max);
  const cut = shown.length < text.length ? ELLIPSIS : '';
  if (!quote) return [{ text: shown + cut, tint: 'string' }];
  return [{ text: `${JSON.stringify(shown).slice(0, -1)}${cut}"`, tint: 'string' }];
}

function numberText(value: number | string): string {
  return Object.is(value, -0) ? '-0' : String(value);
}

function bigintText(value: bigint | string): string {
  const text = String(value);
  return text.endsWith('n') ? text : `${text}n`;
}

function errorHeadline(value: { name?: string; message?: string }): string {
  const name = value.name || 'Error';
  return value.message ? `${name}: ${value.message}` : name;
}

function errorFullText(value: { name?: string; message?: string; stack?: string }): string {
  return value.stack || errorHeadline(value);
}

function keyText(name: string): string {
  return IDENTIFIER.test(name) || /^\d+$/.test(name) ? name : JSON.stringify(name);
}

function functionTokens(value: Extract<ValuePreview, { type: 'function' }>, nested: boolean): ValueToken[] {
  if (value.flavor === 'class') {
    return [{ text: 'class', tint: 'keyword' }, ...(value.name ? [{ text: ` ${value.name}`, tint: 'function' as const }] : [])];
  }
  const out: ValueToken[] = [];
  if (value.flavor === 'async' || value.flavor === 'async generator') out.push({ text: 'async ', tint: 'keyword' });
  out.push({ text: value.flavor === 'generator' || value.flavor === 'async generator' ? 'ƒ*' : 'ƒ', tint: 'functionMark' });
  if (nested) return out;
  out.push({ text: ` ${value.name ?? ''}(${value.params ?? ''})`, tint: 'function' });
  return out;
}

/** `Foo(3)`: a collection's name and size, with no contents. */
function collectionName(value: { className?: string }, fallback: string, size: number | undefined): string {
  return `${value.className || fallback}${size === undefined ? '' : `(${size})`}`;
}

function joined<T>(items: readonly T[], limit: number, more: boolean, one: (item: T) => ValueToken[]): ValueToken[] {
  const out: ValueToken[] = [];
  items.slice(0, limit).forEach((item, i) => {
    if (i) out.push({ text: ', ', tint: 'punctuation' });
    out.push(...one(item));
  });
  if (more || items.length > limit) {
    if (out.length) out.push({ text: ', ', tint: 'punctuation' });
    out.push({ text: ELLIPSIS, tint: 'punctuation' });
  }
  return out;
}

function tokensOf(value: ValuePreview, options: Required<ValuePreviewOptions>, depth: number): ValueToken[] {
  const nested = depth > 0;
  const inner = (v: ValuePreview) => tokensOf(v, { ...options, maxString: Math.min(options.maxString, NESTED_STRING_LENGTH), quote: true }, depth + 1);
  switch (value.type) {
    case 'string':
      return stringTokens(value.value, options.maxString, options.quote);
    case 'number':
      return [{ text: numberText(value.value), tint: 'number' }];
    case 'boolean':
      return [{ text: String(value.value), tint: 'keyword' }];
    case 'null':
      return [{ text: 'null', tint: 'nullish' }];
    case 'undefined':
      return [{ text: 'undefined', tint: 'nullish' }];
    case 'bigint':
      return [{ text: bigintText(value.value), tint: 'number' }];
    case 'symbol':
      return [{ text: value.value, tint: 'symbol' }];
    case 'function':
      return functionTokens(value, nested);
    case 'date':
      return [{ text: value.value, tint: 'date' }];
    case 'regexp':
      return [{ text: value.value, tint: 'regexp' }];
    case 'error': {
      if (options.expanded) {
        const full = errorFullText(value);
        return [{ text: clipString(full, options.maxString) + (full.length > options.maxString ? ELLIPSIS : ''), tint: 'error' }];
      }
      // One line, however many the message has.
      const headline = errorHeadline(value);
      const line = headline.split('\n', 1)[0] ?? '';
      const max = nested ? NESTED_STRING_LENGTH : options.maxString;
      return [{ text: clipString(line, max) + (line.length > max || line.length < headline.length ? ELLIPSIS : ''), tint: 'error' }];
    }
    case 'accessor':
      return [{ text: '(...)', tint: 'muted' }];
    case 'unavailable':
      return [{ text: value.label ?? '<unavailable>', tint: 'muted' }];
    case 'entry':
      return [...inner(value.key), { text: ' => ', tint: 'punctuation' }, ...inner(value.value)];
    case 'object': {
      const named = value.className && value.className !== 'Object' ? value.className : '';
      if (nested || !value.properties) {
        return named ? [{ text: named, tint: 'className' }] : [{ text: value.properties?.length === 0 ? '{}' : `{${ELLIPSIS}}`, tint: 'punctuation' }];
      }
      return [
        ...(named ? [{ text: `${named} `, tint: 'className' as const }] : []),
        { text: '{', tint: 'punctuation' },
        ...joined(value.properties, OBJECT_PREVIEW_ENTRIES, !!value.overflow, (p) => [
          { text: keyText(p.name), tint: 'key' },
          { text: ': ', tint: 'punctuation' },
          ...inner(p.value),
        ]),
        { text: '}', tint: 'punctuation' },
      ];
    }
    case 'array': {
      const named = value.className && value.className !== 'Array' ? value.className : '';
      const length = value.length ?? value.items?.length;
      if (nested || !value.items) return [{ text: collectionName(value, 'Array', length), tint: 'className' }];
      const more = !!value.overflow || (length !== undefined && length > value.items.length);
      const label = `${named}${length ? `(${length}) ` : named ? ' ' : ''}`;
      return [
        ...(label ? [{ text: label, tint: 'className' as const }] : []),
        { text: '[', tint: 'punctuation' },
        ...joined(value.items, LIST_PREVIEW_ENTRIES, more, inner),
        { text: ']', tint: 'punctuation' },
      ];
    }
    case 'map':
    case 'set': {
      const fallback = value.type === 'map' ? 'Map' : 'Set';
      const known = value.type === 'map' ? value.entries : value.items;
      const size = value.size ?? known?.length;
      const name: ValueToken = { text: collectionName(value, fallback, size), tint: 'className' };
      if (nested || !known) return [name];
      const more = !!value.overflow || (size !== undefined && size > known.length);
      return [
        name,
        { text: ' {', tint: 'punctuation' },
        ...(value.type === 'map'
          ? joined(value.entries ?? [], OBJECT_PREVIEW_ENTRIES, more, (e) => [...inner(e.key), { text: ' => ', tint: 'punctuation' }, ...inner(e.value)])
          : joined(value.items ?? [], LIST_PREVIEW_ENTRIES, more, inner)),
        { text: '}', tint: 'punctuation' },
      ];
    }
  }
}

/** A preview as tinted runs of text, DevTools-style: `{a: 1, b: "x", …}`, `(3) [1, 2, 3]`, `Map(2) {"a" => 1}`. */
export function previewTokens(value: ValuePreview, options: ValuePreviewOptions = {}): ValueToken[] {
  return tokensOf(value, { maxString: options.maxString ?? STRING_PREVIEW_LENGTH, quote: options.quote ?? true, expanded: !!options.expanded }, 0);
}

/** A preview as plain text. */
export function previewText(value: ValuePreview, options?: ValuePreviewOptions): string {
  return previewTokens(value, options).map((t) => t.text).join('');
}

/** What copying a value gives you: a string's own text, an error's stack, otherwise what the preview says. */
export function copyTextOf(value: ValuePreview): string {
  if (value.type === 'string') return value.value;
  if (value.type === 'error') return errorFullText(value);
  return previewText(value, { maxString: Infinity });
}

/** All there is to read of a string or an error. Nothing else can be cut short. */
export function fullLength(value: ValuePreview): number {
  if (value.type === 'string') return value.value.length;
  return value.type === 'error' ? errorFullText(value).length : 0;
}

/** How many characters of a value `shown` leaves out: what a Show more would reveal. */
export function hiddenLength(value: ValuePreview, shown: number, expanded = false): number {
  if (value.type === 'string') return Math.max(0, value.value.length - shown);
  if (value.type !== 'error') return 0;
  const full = errorFullText(value);
  // Not opened yet, an error shows one line of its headline, and any more of it or a stack is worth a press.
  if (!expanded) return full === errorHeadline(value) && !full.includes('\n') && full.length <= shown ? 0 : full.length;
  return Math.max(0, full.length - shown);
}

/** How much a Show more adds: ten times as much each press, so a many-megabyte string takes a few presses rather than a
 *  long stall. Anything up to 128 KB comes at once. */
export function nextShownLength(length: number, shown: number): number {
  const next = Math.max(shown * 10, 65536);
  return next * 2 > length ? length : next;
}

/** `812 B`, `1.2 kB`, `3.4 MB`. */
export function formatLength(length: number): string {
  if (length < 1000) return `${length} B`;
  if (length < 1e6) return `${(length / 1e3).toFixed(1)} kB`;
  return `${(length / 1e6).toFixed(1)} MB`;
}

/* ── Live JavaScript values ── */

function functionPreview(fn: (...args: never[]) => unknown): ValuePreview {
  const tag = Object.prototype.toString.call(fn);
  let source = '';
  try {
    source = Function.prototype.toString.call(fn).slice(0, 300);
  } catch {
    /* A proxy has no source. */
  }
  const name = fn.name || undefined;
  if (/^class[\s{]/.test(source)) return { type: 'function', flavor: 'class', name };
  const flavor = tag.includes('AsyncGenerator') ? 'async generator' : tag.includes('Async') ? 'async' : tag.includes('Generator') ? 'generator' : undefined;
  const params = /\(([^()]*)\)/.exec(source)?.[1]?.replace(/\s+/g, ' ').trim();
  return { type: 'function', name, params, ...(flavor ? { flavor } : {}) };
}

function ownClassName(value: object): string | undefined {
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null) return 'Object';
  const name = (proto as { constructor?: { name?: unknown } }).constructor?.name;
  return typeof name === 'string' && name ? name : undefined;
}

export function isTypedArray(value: object): value is Uint8Array {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

/** Describes a live JavaScript value, one level deep. */
export function previewFromValue(value: unknown, depth = 0): ValuePreview {
  switch (typeof value) {
    case 'string':
      return { type: 'string', value };
    case 'number':
      return { type: 'number', value: Object.is(value, -0) ? '-0' : value };
    case 'boolean':
      return { type: 'boolean', value };
    case 'undefined':
      return { type: 'undefined' };
    case 'bigint':
      return { type: 'bigint', value };
    case 'symbol':
      return { type: 'symbol', value: String(value) };
    case 'function':
      return functionPreview(value as (...args: never[]) => unknown);
  }
  if (value === null) return { type: 'null' };
  const object = value as object;
  const className = ownClassName(object);
  if (value instanceof Date) {
    const time = value.getTime();
    return { type: 'date', value: Number.isNaN(time) ? 'Invalid Date' : value.toISOString() };
  }
  if (value instanceof RegExp) return { type: 'regexp', value: String(value) };
  if (value instanceof Error) return { type: 'error', name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) {
    if (depth > 0) return { type: 'array', length: value.length };
    return { type: 'array', length: value.length, items: value.slice(0, LIST_PREVIEW_ENTRIES).map((v) => previewFromValue(v, depth + 1)) };
  }
  if (isTypedArray(object)) {
    const length = object.length;
    if (depth > 0) return { type: 'array', className, length };
    return { type: 'array', className, length, items: Array.from(object.subarray(0, LIST_PREVIEW_ENTRIES), (v) => previewFromValue(v, depth + 1)) };
  }
  if (value instanceof Map) {
    if (depth > 0) return { type: 'map', className, size: value.size };
    const entries: ValueMapEntry[] = [];
    for (const [k, v] of value) {
      if (entries.length === OBJECT_PREVIEW_ENTRIES) break;
      entries.push({ key: previewFromValue(k, depth + 1), value: previewFromValue(v, depth + 1) });
    }
    return { type: 'map', className, size: value.size, entries };
  }
  if (value instanceof Set) {
    if (depth > 0) return { type: 'set', className, size: value.size };
    const items: ValuePreview[] = [];
    for (const v of value) {
      if (items.length === LIST_PREVIEW_ENTRIES) break;
      items.push(previewFromValue(v, depth + 1));
    }
    return { type: 'set', className, size: value.size, items };
  }
  if (depth > 0) return { type: 'object', className };
  const keys = Object.keys(object);
  const properties = keys.slice(0, OBJECT_PREVIEW_ENTRIES).map((name): ValueProperty => {
    const held = Object.getOwnPropertyDescriptor(object, name);
    return { name, value: held?.get || held?.set ? { type: 'accessor' } : previewFromValue(held?.value, depth + 1) };
  });
  return { type: 'object', className, properties, overflow: keys.length > OBJECT_PREVIEW_ENTRIES };
}
