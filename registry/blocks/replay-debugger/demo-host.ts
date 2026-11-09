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
  Peek,
  ProtocolValue,
  ScopeData,
  StepClock,
  StepInfo,
  TimelineMarks,
} from './host';

/* ══ A recording you can hold in your hand ══
   Everything the debugger block asks of a host, answered from a table: a short program, already run. It's what the block's
   docs and stories run on, and what its tests do. A host with a real engine answers the same questions, and nothing in the
   block can tell. */

export const CART_SOURCE = `function lineTotal(item) {
  const price = item.price * item.qty;
  return item.discount ? price * 0.9 : price;
}

function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += lineTotal(item);
  }
  return sum;
}

const items = [
  { name: "Tea", price: 4, qty: 2 },
  { name: "Mug", price: 12, qty: 1, discount: true },
];
const result = total(items);
console.log("total", result);
`;

const SourceId = 'cart';

interface Stop {
  line: number;
  column: number;
  /** Outermost first. */
  stack: string[];
  locals: Record<string, unknown>;
}

const TEA = { name: 'Tea', price: 4, qty: 2 };
const MUG = { name: 'Mug', price: 12, qty: 1, discount: true };
const ITEMS = [TEA, MUG];

const top = ['(top level)'];
const inTotal = ['(top level)', 'total'];
const inLine = ['(top level)', 'total', 'lineTotal'];

/* Each statement as it ran. */
const STOPS: Stop[] = [
  { line: 14, column: 0, stack: top, locals: {} },
  { line: 18, column: 0, stack: top, locals: { items: ITEMS } },
  { line: 7, column: 2, stack: inTotal, locals: { items: ITEMS } },
  { line: 8, column: 20, stack: inTotal, locals: { items: ITEMS, sum: 0 } },
  {
    line: 9,
    column: 4,
    stack: inTotal,
    locals: { items: ITEMS, sum: 0, item: TEA },
  },
  { line: 2, column: 2, stack: inLine, locals: { item: TEA } },
  { line: 3, column: 2, stack: inLine, locals: { item: TEA, price: 8 } },
  { line: 4, column: 0, stack: inLine, locals: { item: TEA, price: 8 } },
  {
    line: 8,
    column: 20,
    stack: inTotal,
    locals: { items: ITEMS, sum: 8, item: TEA },
  },
  {
    line: 9,
    column: 4,
    stack: inTotal,
    locals: { items: ITEMS, sum: 8, item: MUG },
  },
  { line: 2, column: 2, stack: inLine, locals: { item: MUG } },
  { line: 3, column: 2, stack: inLine, locals: { item: MUG, price: 12 } },
  { line: 4, column: 0, stack: inLine, locals: { item: MUG, price: 12 } },
  {
    line: 8,
    column: 20,
    stack: inTotal,
    locals: { items: ITEMS, sum: 18.8, item: MUG },
  },
  { line: 11, column: 2, stack: inTotal, locals: { items: ITEMS, sum: 18.8 } },
  { line: 12, column: 0, stack: inTotal, locals: { items: ITEMS, sum: 18.8 } },
  { line: 19, column: 0, stack: top, locals: { items: ITEMS, result: 18.8 } },
  { line: 20, column: 0, stack: top, locals: { items: ITEMS, result: 18.8 } },
];

/** The time of each step, with a gap in it, for what the block says when no JS is running. */
const timeOf = (step: number) => (step < 9 ? 100 + step * 10 : 400 + step * 10);
const lastStep = STOPS.length - 1;

const stepInfo = (step: number): StepInfo => ({
  index: step,
  progress: step * 100,
  location: {
    sourceId: SourceId,
    line: STOPS[step].line,
    column: STOPS[step].column,
  },
});

function valueData(
  value: unknown,
  objects: Map<string, ObjectData>,
  ids: Map<unknown, string>,
): ProtocolValue {
  if (value === null || typeof value !== 'object')
    return value === undefined ? {} : { value };
  let id = ids.get(value);
  if (id) return { object: id };
  id = `o${ids.size + 1}`;
  ids.set(value, id);
  if (Array.isArray(value)) {
    const properties = value.map((v, i) => ({
      name: String(i),
      ...valueData(v, objects, ids),
    }));
    objects.set(id, {
      objectId: id,
      className: 'Array',
      preview: {
        properties: [
          ...properties,
          { name: 'length', value: value.length, flags: 1 },
        ],
      },
    });
  } else {
    objects.set(id, {
      objectId: id,
      className: 'Object',
      preview: {
        properties: Object.entries(value).map(([name, v]) => ({
          name,
          ...valueData(v, objects, ids),
        })),
      },
    });
  }
  return { object: id };
}

function pauseData(step: number): PauseData {
  const objects = new Map<string, ObjectData>();
  const ids = new Map<unknown, string>();
  const stop = STOPS[step];
  const frames: FrameData[] = [];
  const scopes: ScopeData[] = [];
  // What's on the stack below the top is where each call was made.
  for (let depth = stop.stack.length - 1; depth >= 0; depth--) {
    const name = stop.stack[depth];
    const here =
      depth === stop.stack.length - 1
        ? stop
        : (STOPS.slice(0, step)
            .reverse()
            .find((s) => s.stack.length === depth + 1) ?? stop);
    const scopeId = `s${step}:${depth}`;
    scopes.push({
      scopeId,
      type: depth ? 'function' : 'global',
      functionName: depth ? name : undefined,
      bindings: Object.entries(here.locals).map(([key, value]) => ({
        name: key,
        ...valueData(value, objects, ids),
      })),
    });
    frames.push({
      frameId: `f${depth}`,
      functionName: depth ? name : undefined,
      displayName: name,
      type: depth ? 'call' : 'global',
      location: [{ sourceId: SourceId, line: here.line, column: here.column }],
      scopeChain: [scopeId],
    });
  }
  return { frames, scopes, objects: [...objects.values()] };
}

/** An expression, as far as a table can: a variable, a path from one, or `{ a, b }`. */
function evaluateAt(
  step: number,
  expression: string,
  frameIndex = 0,
): EvaluationResult {
  const stop = STOPS[step];
  const frameLocals = frameIndex
    ? (
        STOPS.slice(0, step)
          .reverse()
          .find((s) => s.stack.length === stop.stack.length - frameIndex) ??
        stop
      ).locals
    : stop.locals;
  const read = (path: string) =>
    path
      .split('.')
      .reduce<unknown>(
        (at, key) => (at as Record<string, unknown> | undefined)?.[key],
        frameLocals,
      );
  const objects = new Map<string, ObjectData>();
  const ids = new Map<unknown, string>();
  const text = expression.trim();
  const shorthand = /^\{\s*([\w$,\s]*)\}$/.exec(text);
  if (shorthand) {
    const names = shorthand[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const value = Object.fromEntries(names.map((n) => [n, read(n)]));
    return {
      returned: valueData(value, objects, ids),
      data: { objects: [...objects.values()] },
    };
  }
  const quoted = /^"(.*)"$/.exec(text);
  if (quoted) return { returned: { value: quoted[1] } };
  if (/^-?\d+(\.\d+)?$/.test(text))
    return { returned: { value: Number(text) } };
  if (/^[A-Za-z_$][\w$.]*$/.test(text) && text.split('.')[0] in frameLocals)
    return {
      returned: valueData(read(text), objects, ids),
      data: { objects: [...objects.values()] },
    };
  return {
    exception: { value: `ReferenceError: ${text} is not defined here` },
  };
}

/** The table's times, as a recording's would be. */
export class DemoClock implements StepClock {
  positionAt(ms: number): { step: number; idle: IdleInfo | null } {
    let step = -1;
    for (let i = 0; i <= lastStep; i++) if (timeOf(i) <= ms) step = i;
    if (step < 0)
      return {
        step: -1,
        idle: { kind: 'before', nextMs: timeOf(0), nextStep: 0 },
      };
    if (step === lastStep && ms > timeOf(lastStep) + 10)
      return { step, idle: { kind: 'after' } };
    if (step < lastStep && timeOf(step + 1) - ms > 20 && ms - timeOf(step) > 20)
      return {
        step,
        idle: { kind: 'between', nextMs: timeOf(step + 1), nextStep: step + 1 },
      };
    return { step, idle: null };
  }

  timeOf(step: number) {
    return timeOf(step);
  }

  approxTimeOf(step: number) {
    return timeOf(step);
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

export const DEMO_SUMMARY: DebuggerSummary = {
  runtime: 'node',
  sources: [{ id: SourceId, url: 'src/cart.js' }],
  consoleMessages: [
    { step: lastStep, location: { sourceId: SourceId, line: 20, column: 0 } },
  ],
  steps: STOPS.length,
  firstStep: 0,
  lastStep,
  timeline: { warning: null },
};

const hitCounts: Record<number, number> = {};
for (const stop of STOPS)
  hitCounts[stop.line] = (hitCounts[stop.line] ?? 0) + 1;

export interface DemoEvents {
  /** The playhead's been taken to a step. */
  onStep?(step: number, ms: number): void;
  onMarks?(marks: TimelineMarks): void;
  status?(text: string): void;
  onLogpoints?(): void;
  /** A logpoint's hit, for the model. */
  onHit?(hit: {
    type: string;
    id: number;
    step: StepInfo;
    result: EvaluationResult;
  }): void;
}

/** Answers everything from the table. `delayMs` is how long a pause seems to take, as a real one does. */
export function createDemoHost(
  events: DemoEvents = {},
  { delayMs = 0, empty = false } = {},
): DebuggerHost {
  if (empty) {
    const unavailable = async (): Promise<never> => {
      throw new Error('The empty demo has no execution data');
    };
    return {
      peek: unavailable,
      navigate: async () => -1,
      loadSource: unavailable,
      prettyPrint: unavailable,
      shownLocations: async (locations) => locations,
      hitsToShow: unavailable,
      pause: unavailable,
      scope: unavailable,
      preview: unavailable,
      evaluate: unavailable,
      logpoint: async () => ({ count: 0, total: 0 }),
      readAhead: () => undefined,
      onStep: (step, ms) => events.onStep?.(step, ms),
      onMarks: (marks) => events.onMarks?.(marks),
      status: (text) => events.status?.(text),
      onLogpoints: () => events.onLogpoints?.(),
    };
  }
  const later = async <T>(value: T): Promise<T> => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return value;
  };
  const depthOf = (step: number) => STOPS[step].stack.length;
  const seek = (
    from: number,
    direction: number,
    wanted: (i: number) => boolean,
  ) => {
    for (let i = from + direction; i >= 0 && i <= lastStep; i += direction)
      if (wanted(i)) return i;
    return -1;
  };
  const navigate = (
    from: number,
    how: NavigationKind,
    breakpoints: { line: number }[],
  ) => {
    const here = from < 0 ? 1 : depthOf(from);
    const hit = (i: number) =>
      breakpoints.some((b) => b.line === STOPS[i].line);
    switch (how) {
      case 'stepIn':
        return from < lastStep ? from + 1 : -1;
      case 'stepInBack':
        return from > 0 ? from - 1 : -1;
      case 'stepOver':
        return seek(from, 1, (i) => depthOf(i) <= here);
      case 'stepOverBack':
        return seek(from, -1, (i) => depthOf(i) <= here);
      case 'stepOut':
        return seek(from, 1, (i) => depthOf(i) < here);
      case 'stepOutBack':
        return seek(from, -1, (i) => depthOf(i) < here);
      case 'continue':
        return breakpoints.length ? seek(from, 1, hit) : lastStep;
      case 'rewind':
        return breakpoints.length ? seek(from, -1, hit) : 0;
      default:
        return -1;
    }
  };
  return {
    peek: (step): Promise<Peek> =>
      Promise.resolve({
        step: stepInfo(step),
        stack: pauseData(step).frames!.map((f) => ({
          name: f.displayName!,
          location: f.location![0],
        })),
        values: null,
      }),
    navigate: (from, how, breakpoints) =>
      Promise.resolve(navigate(from, how, breakpoints)),
    loadSource: (id): Promise<LoadedSource> =>
      Promise.resolve({
        id,
        url: 'src/cart.js',
        contents: CART_SOURCE,
        breakableLines: Object.keys(hitCounts)
          .map(Number)
          .sort((a, b) => a - b),
        hitCounts,
      }),
    prettyPrint: () => Promise.resolve('none'),
    shownLocations: (locations: Location[]) => Promise.resolve(locations),
    hitsToShow: (_, line): Promise<Hits> =>
      Promise.resolve(
        STOPS.flatMap((stop, i) => (stop.line === line ? [stepInfo(i)] : [])),
      ),
    pause: (step) => later({ frames: { data: pauseData(step) } }),
    scope: (): Promise<DataAnswer> => Promise.resolve({ data: {} }),
    preview: (): Promise<DataAnswer> => Promise.resolve({ data: {} }),
    evaluate: (step, frameId, expression) =>
      later(
        evaluateAt(
          step,
          expression,
          frameId ? depthOf(step) - 1 - Number(frameId.slice(1)) : 0,
        ),
      ),
    logpoint: async (run, _source, line, expression) => {
      const hits = STOPS.flatMap((stop, i) => (stop.line === line ? [i] : []));
      for (const step of hits)
        events.onHit?.({
          type: 'logpoint-hit',
          id: run,
          step: stepInfo(step),
          result: evaluateAt(step, expression),
        });
      return { count: hits.length, total: hits.length };
    },
    readAhead: () => undefined,
    onStep: (step, ms) => events.onStep?.(step, ms),
    onMarks: (marks) => events.onMarks?.(marks),
    status: (text) => events.status?.(text),
    onLogpoints: () => events.onLogpoints?.(),
  };
}
