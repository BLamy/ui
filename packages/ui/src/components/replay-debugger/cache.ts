import type {
  DataAnswer,
  DebuggerHost,
  DebuggerSummary,
  EvaluationResult,
  FrameData,
  Hits,
  IdleInfo,
  LoadedSource,
  Location,
  NavigationKind,
  ObjectData,
  PauseData,
  PeekedFrame,
  ProtocolValue,
  ScopeData,
  StepClock,
  StepInfo,
  TimelineMarks,
} from './host';

/* ══ A recording, read once ══
   What a replay engine says about a short recording, written down by an extractor kept outside this repository: it drives the
   native linker over a recording.dat once, pauses at every step in the program's own sources, and keeps where each step
   is, where each kind of step goes from it, and the frames, scopes and objects there, each frame, scope and object once
   in a pool, named by what it holds. A page loads
   that JSON and answers the debugger, the trace timeline and a test story from it, with no engine anywhere. The same idea
   as rr-dash's bundle, in the shape of this block's DebuggerHost. */

export interface CachedSource {
  id: string;
  kind?: string;
  /** The file's name. */
  url: string;
  contents: string;
  breakableLines: number[];
  /** How many times each line ran, by line number. */
  hitCounts: Record<number, number>;
}

/** One step as the JSON keeps it. */
export interface CachedStepData {
  /** The step's index in the whole recording. Steps in other sources are left out, so these have gaps. */
  index: number;
  progress: number;
  /** When it ran, in ms on the recording's clock. */
  ms: number;
  /** How deep the stack was: 0 at top level. */
  depth: number;
  location: Location;
  /** Its frames, innermost first, by their names in the pool. */
  frames: string[];
  /** Where each kind of step goes from here without breakpoints, in `STEPPING`'s order; -1 for nowhere in the kept sources. */
  nav: number[];
}

/** A step with what's in the pool for it: what the rest of the block reads. */
export interface CachedStep extends Omit<CachedStepData, 'frames' | 'nav'> {
  /** Innermost first. */
  stack: PeekedFrame[];
  nav: Partial<Record<NavigationKind, number>>;
  /** Frames (innermost first), their scopes but the global one, and the objects reachable from those. */
  pause: Required<PauseData>;
}

/** The order of `CachedStepData.nav`. */
export const STEPPING: readonly NavigationKind[] = ['stepIn', 'stepInBack', 'stepOver', 'stepOverBack', 'stepOut', 'stepOutBack'];

export interface CachedConsoleMessage {
  step: number;
  ms: number | null;
  level: string;
  text: string;
  location: Location | null;
}

/** A recording's console as rows for the debugger's console, each knowing the step that logged it. */
export function cachedConsoleRows(cache: ReplayCache) {
  const urls = new Map(cache.sources.map((s) => [s.id, s.url]));
  return cache.console.map((m, i) => ({
    id: `console-${i}`,
    step: m.step,
    level: m.level,
    time: m.ms ?? 0,
    source: m.location ? `${urls.get(m.location.sourceId) ?? ''}:${m.location.line}` : undefined,
    message: m.text,
  }));
}

export interface ReplayCache {
  format: 'bl-replay-cache/2';
  recording: {
    name: string;
    bytes: number;
    sha256: string;
    buildId: string;
    linkerVersion: string | null;
    runtime: string;
    /** Every step in the recording, kept or not. */
    steps: number;
  };
  sources: CachedSource[];
  /** In order. */
  steps: CachedStepData[];
  /** Every frame, scope and object any step has, each once, named by a hash of what it holds. */
  pool: { frames: FrameData[]; scopes: ScopeData[]; objects: ObjectData[] };
  /** Each kept line's executions, by source and line: step indexes, in order. */
  hits: Record<string, Record<number, number[]>>;
  console: CachedConsoleMessage[];
}

/** Steps and lookups over a cache, built once per cache. A step's pause is put together from the pool the first time
 *  it's asked for. */
export class CacheIndex {
  readonly sources = new Map<string, CachedSource>();
  readonly times: Float64Array;
  private readonly data = new Map<number, CachedStepData>();
  private readonly hydrated = new Map<number, CachedStep>();
  private readonly frames = new Map<string, FrameData>();
  private readonly scopes = new Map<string, ScopeData>();
  private readonly objects = new Map<string, ObjectData>();
  private readonly lines = new Map<string, string[]>();

  constructor(readonly cache: ReplayCache) {
    for (const step of cache.steps) this.data.set(step.index, step);
    for (const source of cache.sources) this.sources.set(source.id, source);
    for (const frame of cache.pool.frames) this.frames.set(frame.frameId, frame);
    for (const scope of cache.pool.scopes) this.scopes.set(scope.scopeId, scope);
    for (const object of cache.pool.objects) this.objects.set(object.objectId, object);
    this.times = Float64Array.from(cache.steps, (s) => s.ms);
  }

  get first() {
    return this.step(this.cache.steps[0]?.index);
  }

  get last() {
    return this.step(this.cache.steps[this.cache.steps.length - 1]?.index);
  }

  /** The step with this index, if it's kept. */
  step(index: number | undefined): CachedStep | undefined {
    if (index === undefined) return undefined;
    const known = this.hydrated.get(index);
    if (known) return known;
    const data = this.data.get(index);
    if (!data) return undefined;
    const frames = data.frames.map((id) => this.frames.get(id)).filter((f): f is FrameData => !!f);
    const scopes = [...new Set(frames.flatMap((f) => f.scopeChain ?? []))].map((id) => this.scopes.get(id)).filter((s): s is ScopeData => !!s);
    const objects = new Map<string, ObjectData>();
    const reach = (id: string | undefined) => {
      const object = id ? this.objects.get(id) : undefined;
      if (!object || objects.has(object.objectId)) return;
      objects.set(object.objectId, object);
      for (const p of [...(object.preview?.properties ?? []), ...(object.preview?.getterValues ?? [])]) reach(p.object);
      for (const e of object.preview?.containerEntries ?? []) {
        reach(e.key?.object);
        reach(e.value.object);
      }
    };
    for (const scope of scopes) {
      reach(scope.object);
      for (const b of scope.bindings ?? []) reach(b.object);
    }
    for (const frame of frames) reach(frame.this?.object);
    const step: CachedStep = {
      index: data.index,
      progress: data.progress,
      ms: data.ms,
      depth: data.depth,
      location: data.location,
      stack: frames.map((f) => ({ name: f.displayName ?? f.functionName ?? (f.type === 'global' ? '(top level)' : '(anonymous function)'), location: f.location?.[0] ?? null })),
      nav: Object.fromEntries(STEPPING.map((how, i) => [how, data.nav[i]]).filter(([, to]) => (to as number) >= 0)),
      pause: { frames, scopes, objects: [...objects.values()] },
    };
    this.hydrated.set(index, step);
    return step;
  }

  /** Every kept step, in order. */
  steps(): CachedStep[] {
    return this.cache.steps.map((s) => this.step(s.index)!);
  }

  /** The kept step at or before `ms`: its position in `cache.steps`, or -1 before the first. */
  ordinalAt(ms: number) {
    let lo = 0;
    let hi = this.times.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.times[mid] <= ms) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  /** The text of a source's line, from 1. */
  lineText(sourceId: string, line: number) {
    let lines = this.lines.get(sourceId);
    if (!lines) {
      lines = this.sources.get(sourceId)?.contents.split('\n') ?? [];
      this.lines.set(sourceId, lines);
    }
    return lines[line - 1] ?? '';
  }

  stepInfo(index: number): StepInfo {
    const step = this.data.get(index);
    return { index, progress: step?.progress ?? 0, location: step?.location ?? null };
  }
}

const indexes = new WeakMap<ReplayCache, CacheIndex>();
/** The cache's index, made the first time it's asked for. */
export const cacheIndex = (cache: ReplayCache) => {
  let index = indexes.get(cache);
  if (!index) indexes.set(cache, (index = new CacheIndex(cache)));
  return index;
};

/* ── Values ── */

/** A value in a line, as an inline value or a story says it: `17.85`, `"Bob"`, `Cart { owner: …, items: Array(2) }`. */
export function valueText(value: ProtocolValue | undefined, objects: readonly ObjectData[] = [], depth = 0): string {
  if (!value || value.unavailable) return '<unavailable>';
  if (value.uninitialized) return '<uninitialized>';
  if ('value' in value) return typeof value.value === 'string' ? JSON.stringify(value.value) : String(value.value);
  if (value.unserializableNumber) return value.unserializableNumber;
  if (value.bigint !== undefined) return `${value.bigint}n`;
  if (value.symbol !== undefined) return value.symbol;
  if (value.object) {
    const object = objects.find((o) => o.objectId === value.object);
    const preview = object?.preview;
    if (preview?.functionName !== undefined) return `ƒ ${preview.functionName || ''}()`;
    if (object?.className === 'Array') {
      const items = preview?.properties?.filter((p) => p.name !== 'length') ?? [];
      return depth > 0 || !items.length ? `Array(${items.length})` : `[${items.slice(0, 4).map((p) => valueText(p, objects, depth + 1)).join(', ')}${items.length > 4 ? ', …' : ''}]`;
    }
    const props = preview?.properties;
    if (!props?.length || depth > 0) return object?.className ?? 'Object';
    const name = object?.className && object.className !== 'Object' ? `${object.className} ` : '';
    return `${name}{ ${props.slice(0, 4).map((p) => `${p.name}: ${valueText(p, objects, depth + 1)}`).join(', ')}${props.length > 4 ? ', …' : ''} }`;
  }
  if (value.get || value.set) return '<accessor>';
  return 'undefined';
}

/** CommonJS's wrapper, in every module's scope: Node's, not the program's. */
const WRAPPER = new Set(['exports', 'require', 'module', '__filename', '__dirname']);

/** The innermost frame's own bindings at a step, as `name = value` pairs, leaving out CommonJS's wrapper. What a test
 *  story shows beside a line. */
export function bindingsAt(step: CachedStep, max = 4): Array<{ name: string; text: string }> {
  const { frames, scopes, objects } = step.pause;
  const first = scopes.find((s) => s.scopeId === frames[0]?.scopeChain?.[0]);
  return (first?.bindings ?? [])
    .filter((b) => !WRAPPER.has(b.name))
    .slice(0, max)
    .map((b) => ({ name: b.name, text: valueText(b, objects) }));
}

/** Reads a path like `cart.items[0].price` from a frame's scopes. Nothing a cache can't answer: no calls, no operators. */
function evaluateAt(step: CachedStep, frameId: string | null, expression: string): EvaluationResult {
  const text = expression.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return { returned: { value: Number(text) } };
  const quoted = /^(['"])(.*)\1$/.exec(text);
  if (quoted) return { returned: { value: quoted[2] } };
  const path = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(text) ? text.match(/[A-Za-z_$][\w$]*|\d+/g)! : null;
  const { frames, scopes, objects } = step.pause;
  const frame = frames.find((f) => f.frameId === frameId) ?? frames[0];
  if (path && frame) {
    let at: ProtocolValue | undefined;
    for (const scopeId of frame.scopeChain ?? []) {
      at = scopes.find((s) => s.scopeId === scopeId)?.bindings?.find((b) => b.name === path[0]);
      if (at) break;
    }
    if (!at && path[0] === 'this') at = frame.this;
    for (const key of path.slice(1)) {
      const objectId = at?.object;
      if (!objectId) { at = undefined; break; }
      const preview = objects.find((o) => o.objectId === objectId)?.preview;
      if (!preview?.properties) return { failed: true, exception: { value: `${text}: the cache didn't keep that deep` } };
      at = preview.properties.find((p) => p.name === key) ?? {};
    }
    if (at) {
      const { name: _name, flags: _flags, ...value } = at as ProtocolValue & { name?: string; flags?: number };
      return { returned: value, data: { objects } };
    }
  }
  return { exception: { value: path ? `ReferenceError: ${path[0]} is not defined here` : 'The cache reads names and paths, like cart.items[0].price; anything else needs the engine' } };
}

/* ── The debugger's host and clock ── */

/** The playhead's time and steps, from the cache's times. */
export class CachedClock implements StepClock {
  private readonly index: CacheIndex;

  constructor(cache: ReplayCache) {
    this.index = cacheIndex(cache);
  }

  positionAt(ms: number): { step: number; idle: IdleInfo | null } {
    const { cache, times } = this.index;
    const at = this.index.ordinalAt(ms);
    if (at < 0) return { step: -1, idle: { kind: 'before', nextMs: times[0], nextStep: cache.steps[0]?.index } };
    const step = cache.steps[at];
    if (at === times.length - 1) return { step: step.index, idle: ms > times[at] + 1 ? { kind: 'after' } : null };
    // More than a millisecond since the last step, and before the next: nothing was running.
    if (ms - times[at] > 1 && times[at + 1] - ms > 1) return { step: step.index, idle: { kind: 'between', nextMs: times[at + 1], nextStep: cache.steps[at + 1].index } };
    return { step: step.index, idle: null };
  }

  timeOf(step: number) {
    return this.index.step(step)?.ms;
  }

  approxTimeOf(step: number) {
    return this.timeOf(step);
  }

  whenReadyAt() {
    return null;
  }

  ensureStep() {
    return null;
  }

  isLoadedAt() {
    return true;
  }

  callsFromStep() {
    return { from: 0, to: 0 };
  }

  stepForCall() {
    return -1;
  }
}

/** What DebuggerModel.ready takes, from the cache. */
export function cachedSummary(cache: ReplayCache): DebuggerSummary {
  return {
    runtime: cache.recording.runtime,
    engineLabel: `cached from ${cache.recording.name}`,
    sources: cache.sources.map(({ id, kind, url }) => ({ id, kind, url })),
    consoleMessages: cache.console.map(({ step, location }) => ({ step, location })),
    steps: cache.recording.steps,
    firstStep: cache.steps[0]?.index ?? -1,
    lastStep: cache.steps[cache.steps.length - 1]?.index ?? -1,
    timeline: {
      warning: null,
      times: cache.steps.map((s) => s.ms),
      depths: cache.steps.map((s) => s.depth),
    },
  };
}

/** Where a step goes, with breakpoints: the cache's own table for stepping, and the lines' hits for continuing. */
export function navigateCached(cache: ReplayCache, from: number, how: NavigationKind, breakpoints: readonly { sourceId: string; line: number }[] = []): number {
  const index = cacheIndex(cache);
  if (how === 'continue' || how === 'rewind') {
    const forward = how === 'continue';
    if (!breakpoints.length) return (forward ? index.last : index.first)?.index ?? -1;
    let best = -1;
    for (const { sourceId, line } of breakpoints) {
      for (const hit of cache.hits[sourceId]?.[line] ?? []) {
        if (forward ? hit > from && (best < 0 || hit < best) : hit < from && hit > best) best = hit;
      }
    }
    return best;
  }
  return index.step(from)?.nav[how] ?? -1;
}

export interface CachedHostEvents {
  onStep?(step: number, ms: number): void;
  onMarks?(marks: TimelineMarks): void;
  status?(text: string): void;
  onLogpoints?(): void;
  /** A logpoint's hit, for the model's `onEvent`. */
  onHit?(hit: { type: 'logpoint-hit'; id: number; step: StepInfo; result: EvaluationResult }): void;
}

/** A DebuggerHost that answers from a ReplayCache: everything the block asks, with no engine. Expressions are read from
 *  the kept scopes, so names and paths work, and anything that would run code says it needs the engine. */
export function createCachedHost(cache: ReplayCache, events: CachedHostEvents = {}): DebuggerHost {
  const index = cacheIndex(cache);
  const at = (step: number) => {
    const found = index.step(step);
    if (!found) throw new Error(`Step ${step} isn't in this cache`);
    return found;
  };
  const objectsFrom = (step: CachedStep, id: string): ObjectData[] => {
    // The object and what it holds, which the values tree opens next.
    const out = new Map<string, ObjectData>();
    const add = (objectId: string | undefined, depth: number) => {
      const object = objectId ? step.pause.objects.find((o) => o.objectId === objectId) : undefined;
      if (!object || out.has(object.objectId) || depth > 1) return;
      out.set(object.objectId, object);
      for (const p of object.preview?.properties ?? []) add(p.object, depth + 1);
    };
    add(id, 0);
    return [...out.values()];
  };
  return {
    peek: async (step) => {
      const found = at(step);
      return { step: index.stepInfo(step), stack: found.stack, values: found.pause };
    },
    navigate: async (from, how, breakpoints) => navigateCached(cache, from, how, breakpoints),
    loadSource: async (id): Promise<LoadedSource> => {
      const source = index.sources.get(id);
      if (!source) throw new Error(`The cache has no source ${id}`);
      return { ...source };
    },
    prettyPrint: async () => 'none',
    shownLocations: async (locations: Location[]) => locations,
    hitsToShow: async (sourceId, line): Promise<Hits> => (cache.hits[sourceId]?.[line] ?? []).map((i) => index.stepInfo(i)),
    pause: async (step) => ({ frames: { data: at(step).pause } }),
    scope: async (step, scopeId): Promise<DataAnswer> => {
      const found = at(step);
      return { data: { scopes: found.pause.scopes.filter((s) => s.scopeId === scopeId), objects: found.pause.objects } };
    },
    preview: async (step, objectId): Promise<DataAnswer> => ({ data: { objects: objectsFrom(at(step), objectId) } }),
    evaluate: async (step, frameId, expression) => evaluateAt(at(step), frameId, expression),
    logpoint: async (run, sourceId, line, expression) => {
      const hits = cache.hits[sourceId]?.[line] ?? [];
      for (const step of hits) {
        events.onHit?.({ type: 'logpoint-hit', id: run, step: index.stepInfo(step), result: evaluateAt(at(step), null, expression) });
      }
      return { count: hits.length, total: hits.length };
    },
    readAhead: () => undefined,
    onStep: (step, ms) => events.onStep?.(step, ms),
    onMarks: (marks) => events.onMarks?.(marks),
    status: (text) => events.status?.(text),
    onLogpoints: () => events.onLogpoints?.(),
  };
}

/* ── A test story ── */

/** One step of a story: a line that ran, how deep, and what its frame held. What a test runner's story view lists, the
 *  way Wallaby and the Replay Tests extension do. */
export interface StoryEntry {
  step: number;
  ms: number;
  depth: number;
  sourceId: string;
  file: string;
  line: number;
  column: number;
  /** The line's code, trimmed. */
  code: string;
  /** The innermost function's name. */
  functionName: string;
  /** The frame's own bindings. */
  values: Array<{ name: string; text: string }>;
  /** A console message logged at this step. */
  logged?: CachedConsoleMessage;
}

/** Every kept step as a story entry, in order. */
export function storyOf(cache: ReplayCache): StoryEntry[] {
  const index = cacheIndex(cache);
  const logged = new Map(cache.console.map((m) => [m.step, m]));
  return index.steps().map((step) => ({
    step: step.index,
    ms: step.ms,
    depth: step.depth,
    sourceId: step.location.sourceId,
    file: index.sources.get(step.location.sourceId)?.url ?? step.location.sourceId,
    line: step.location.line,
    column: step.location.column ?? 0,
    code: index.lineText(step.location.sourceId, step.location.line).trim(),
    functionName: step.stack[0]?.name ?? '(top level)',
    values: bindingsAt(step),
    logged: logged.get(step.index),
  }));
}

/** The frames at a step, innermost first, for code that wants them without a model. */
export const framesAt = (cache: ReplayCache, step: number): FrameData[] => cacheIndex(cache).step(step)?.pause.frames ?? [];
