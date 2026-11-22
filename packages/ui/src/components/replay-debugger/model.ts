import { stopFrom } from './seed-stops';
import type {
  CallRow,
  DebuggerHost,
  DebuggerSummary,
  EvaluationResult,
  FrameData,
  Hits,
  IdleInfo,
  LoadedSource,
  Location,
  LogpointHit,
  LogpointInfo,
  NavigationKind,
  ObjectData,
  PauseData,
  PeekedFrame,
  PrettyState,
  ScopeData,
  SeedStop,
  SourceEntry,
  StepClock,
  StepInfo,
  TimelineMarks,
} from './host';

/* ══ One recording's debugger, with no DOM in it ══
   Everything a person can do at a step, and everything that's true there: the same behaviour as the old UI's
   RecordingDebugger, kept in fields so that whichever panels are showing can read it, and so can the checks. Moving the
   playhead shows the line and the stack straight away from the scan, and frames and values from the engine when they're
   here. Stepping here moves the playhead. */

/** How long a backward drag has to pause before it's worth starting a new engine process. */
const BackwardDragDelayMs = 120;
/** How long to wait for a source to be pretty printed before showing it raw: most only take a moment, and it's better
 *  not to flash a wall of minified code. */
const PrettyPrintWaitMs = 500;
/** How many of a step's system calls to list. */
const CallListLimit = 12;
/** How long the playhead has to stay still before DevTools follows it. */
const DevToolsFollowDelayMs = 150;

export interface DebuggerModelOptions {
  /** Monotonic clock for displayed pause latency. Defaults to performance.now. */
  now?: () => number;
}
/** Which executions to mark on the timeline. It has a pixel for each of however many, so on a line that's run millions of
 *  times, a sample of them looks the same. */
const MarkedHits = 50000;
const PreviewsFetched = 40;

export interface Pause {
  frames: FrameData[];
  objects: Map<string, ObjectData>;
  scopes: Map<string, ScopeData>;
  /** It came from another process, read ahead, so its IDs mean nothing to the live one. */
  readAhead?: boolean;
  ms?: number;
  tooEarly?: boolean;
  prefetched?: Set<string>;
}

export interface Breakpoint {
  sourceId: string;
  line: number;
  enabled: boolean;
  /** The expression, for a logpoint. */
  logpoint: string | null;
  hits: Hits;
}

export interface LogpointResults {
  run: number;
  entries: LogpointHit[];
  info: LogpointInfo | null;
}

export interface Evaluation {
  expression: string;
  step: number;
  frame: string;
  result: EvaluationResult | null;
  error: string | null;
  objects?: Map<string, ObjectData>;
  /** Numeric identity only: history must not retain an entire old pause. */
  pauseContext?: number;
}

export interface LinePanel {
  key: string;
  line: number;
  sourceId: string;
  logpoint: boolean;
}

/* What the panels and the checks read off a frame, whichever way it came. */
export type StackFrame =
  FrameData | { displayName: string; location: (Location | null)[] };

export function frameName(frame: StackFrame) {
  const f = frame as FrameData;
  return (
    f.displayName ||
    f.functionName ||
    (f.type === 'global' ? '(top level)' : '(anonymous function)')
  );
}

export function sourceName(source: SourceEntry | undefined) {
  if (!source) return '?';
  // Original sources have paths from the project, which say more than a file name.
  if (source.kind === 'original') return source.url ?? source.id;
  const url = source.url || source.prettyOf || source.id;
  return url.split('/').pop() || url;
}

export function formatCount(n: number | undefined) {
  if (!n) return '0';
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return `${(n / 1e6).toFixed(1)}m`;
}

const NotVariables = new Set(
  'const let var function return if else for of in while do new this typeof instanceof await async class extends super throw try catch finally true false null undefined void delete yield switch case break continue default import export from console Math JSON Object Array Number String Promise require module process'.split(
    ' ',
  ),
);

/** A starting logpoint expression: the variables a line reads, logged as an object so each shows with its name, like
 *  `{ amount, rate }`. */
export function defaultLogpoint(text: string | undefined, line: number) {
  const code = (text || '')
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""')
    .replace(/\/\/.*$/, '');
  const declared = new Set<string>();
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([[{]?[^=;]*)/g)) {
    for (const id of m[1].match(/[A-Za-z_$][\w$]*/g) || []) declared.add(id);
  }
  const names: string[] = [];
  for (const m of code.matchAll(
    /(?<![.\w$])([A-Za-z_$][\w$]*)(?![\w$])(?!\s*\()/g,
  )) {
    const id = m[1];
    if (NotVariables.has(id) || declared.has(id) || names.includes(id))
      continue;
    if (
      /^\s*:/.test(code.slice(m.index + id.length)) &&
      /[{,]\s*$/.test(code.slice(0, m.index))
    )
      continue;
    names.push(id);
  }
  return names.length
    ? `{ ${names.slice(0, 4).join(', ')} }`
    : `"line ${line}"`;
}

/** A line's executions come as one object per step, or as just the steps on a line that's run a lot. They're in order, so
 *  the rest of this doesn't need to go through them. */
export function hitStep(hits: Hits, i: number) {
  return hits instanceof Float64Array
    ? i < hits.length
      ? hits[i]
      : undefined
    : (hits as StepInfo[])[i]?.index;
}

/** How many of a line's executions are at or before a step. */
export function hitAfter(hits: Hits, step: number) {
  let lo = 0;
  let hi = hits.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (hitStep(hits, mid)! > step) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function markedSteps(hits: Hits) {
  if (!(hits instanceof Float64Array))
    return (hits as StepInfo[]).map((s) => s.index);
  const every = Math.max(1, Math.ceil(hits.length / MarkedHits));
  const steps: number[] = [];
  for (let i = 0; i < hits.length; i += every) steps.push(hits[i]);
  return steps;
}

export class DebuggerModel {
  file: string;
  host: DebuggerHost;
  summary: DebuggerSummary | null = null;
  map: StepClock | null = null;
  sourceEntries = new Map<string, SourceEntry>();
  /** Whether a panel of it is showing. A debugger that isn't doesn't ask the engine for anything. */
  shown = false;

  step = -1;
  stepInfo: StepInfo | null = null;
  idle: IdleInfo | null = null;
  playheadMs: number | null = null;
  scrubbing = false;
  applicationCodeOnly = true;
  applicationCodeUnavailable = false;
  /** The call stack from the scan, until the engine's frames arrive. */
  stackPreview: { displayName: string; location: (Location | null)[] }[] = [];
  pause: Pause | null = null;
  /** The step last asked of the engine. */
  engineStep = -1;
  selectedFrame = 0;
  /** What's going on, while a part of a very long recording is on its way. */
  windowText: string | null = null;
  /** How far through indexing the whole of it, if that's going on behind the part that's here. */
  wholeProgress: number | null = null;
  /** How far through the recording what can be forked from has got, until it's been all the way. */
  replayProgress: number | null = null;
  /** An actual cache reduction, or current OS memory pressure, from this recording's tree. */
  memoryNotice: { reason: 'budget' | 'pressure'; budgetMB: number } | null =
    null;
  /** The previous scopes stay, dimmed, so dragging doesn't make them flicker. */
  scopesStale = false;
  scopesError: string | null = null;
  /** Goes up when the scopes have something new to show. */
  scopesVersion = 0;

  showFramework = false;
  sourceId: string | null = null;
  sources = new Map<string, LoadedSource>();
  /** Minified source -> "formatting", "ready" or "failed". */
  prettyStates = new Map<string, PrettyState>();
  prettyErrors: Record<string, string> = {};
  /** Pretty printed sources being looked at raw instead. */
  rawViews = new Set<string>();

  /** `${sourceId}:${line}` -> what's there. */
  breakpoints = new Map<string, Breakpoint>();
  logpointResults = new Map<string, LogpointResults>();
  /** `${sourceId}:${line}` -> the line's executions, as steps in order. */
  lineHits = new Map<string, Hits>();
  /** `${sourceId}:${line}` -> lines with an open panel. */
  openNavigators = new Map<string, { sourceId: string; line: number }>();
  evaluations: Evaluation[] = [];

  calls: { rows: CallRow[]; more: number } = { rows: [], more: 0 };

  /** Goes up when a line's marks or panels change. */
  marksVersion = 0;
  /** The marks last published for a timeline: breakpoint, logpoint and console times. */
  timelineMarks: TimelineMarks | null = null;
  /** A line to bring into view, whenever whoever's showing the code next can. */
  scrollRequest: { line: number; seq: number } | null = null;
  /** The Sources list: whether it's open, where it's a thing to open. */
  sourcesOpen = false;
  /** The source browser's highlight survives a window layout change. */
  sourcePickerSelection: string | null = null;

  devToolsClients = 0;
  /** Where another client can attach, once it's been opened. */
  devToolsAddress = '';
  private devToolsSeq = 0;
  private devToolsTimer: ReturnType<typeof setTimeout> | undefined;

  private sourceLoads = new Map<string, Promise<LoadedSource>>();
  private selection = 0;
  private prettyWaiting = new Map<string, (() => void)[]>();
  private pauseToken = 0;
  private playheadRequest = 0;
  private nextPauseContext = 0;
  private pauseContexts = new WeakMap<Pause, number>();
  private logpointRun = 0;
  private refreshing = false;
  private refreshAgain = false;
  private consoleTimer: ReturnType<typeof setTimeout> | undefined;
  private scrollSeq = 0;
  private opened = false;
  private disposed = false;

  private background(work: Promise<unknown>) {
    void work.catch((error) => {
      if (!this.disposed)
        this.host.status((error as Error).message, { error: true });
    });
  }

  dispose() {
    this.disposed = true;
    this.shown = false;
    ++this.selection;
    clearTimeout(this.devToolsTimer);
    clearTimeout(this.consoleTimer);
    this.processReleased();
    for (const waiting of this.prettyWaiting.values())
      for (const resolve of waiting) resolve();
    this.prettyWaiting.clear();
  }

  /* ── For whatever's showing it ── */

  private listeners = new Set<() => void>();
  version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  changed() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  private readonly now: () => number;

  constructor(
    file: string,
    host: DebuggerHost,
    { now = () => performance.now() }: DebuggerModelOptions = {},
  ) {
    this.file = file;
    this.host = host;
    this.now = now;
  }

  /** The recording's index is built, and from here on it knows where everything is. On a very long recording it's
   *  called again for each part it goes to, where steps have other numbers and lines ran other numbers of times. */
  ready(summary: DebuggerSummary, map: StepClock) {
    if (this.disposed) return;
    const another = !!this.map;
    this.summary = summary;
    this.sourceEntries = new Map(summary.sources.map((s) => [s.id, s]));
    this.map = map;
    this.windowText = null;
    if (another) this.forgetSteps();
    // Something could have been pretty printed before there was anything to update.
    if (this.prettyStates.size) this.background(this.refreshLocations());
    this.publishMarks();
    this.changed();
  }

  /** What's kept by step or by how many times a line ran, which isn't right for another part of the recording. */
  private forgetSteps() {
    this.pauseToken++;
    this.step = -1;
    this.engineStep = -1;
    this.pause = null;
    this.idle = null;
    this.stepInfo = null;
    this.stackPreview = [];
    this.selectedFrame = 0;
    this.calls = { rows: [], more: 0 };
    this.lineHits.clear();
    this.logpointResults.clear();
    // What's showing stays until the new counts for it are here. Asking again gets those.
    this.sourceLoads.clear();
    this.background(this.reloadLines());
  }

  private async reloadLines() {
    for (const bp of this.breakpoints.values()) {
      if (this.disposed) return;
      bp.hits = await this.hitsFor(bp.sourceId, bp.line);
    }
    if (this.disposed) return;
    if (this.sourceId) await this.loadSource(this.sourceId).catch(() => {});
    this.marksChanged();
    this.publishMarks();
    this.changed();
  }

  /** Whether a time is in another part of a very long recording than the one that's here. */
  outsideWindow(ms: number) {
    const w = this.summary?.window;
    return (
      !!w &&
      ((w.number > 0 && ms < w.startMs) ||
        (w.number < w.of - 1 && ms > w.endMs))
    );
  }

  /** The source to start on: what the recording's own author wrote. */
  private firstSource() {
    const { sources } = this.summary!;
    const own = (s: SourceEntry) => !s.internal && !s.framework && !s.generated;
    return (
      sources.find((s) => own(s) && s.url && !s.url.startsWith('node:')) ||
      sources.find((s) => !s.internal) ||
      sources[0]
    );
  }

  /** A panel of this is showing now, or isn't any more. Going back to it catches up with where the playhead has got to,
   *  at a step when the playhead was put on an exact one. */
  async show(
    ms: number,
    step: number | null,
    {
      scrubbing = false,
      call = null,
    }: { scrubbing?: boolean; call?: number | null } = {},
  ) {
    if (this.disposed) return;
    this.shown = true;
    if (!this.map) return;
    const token = this.pauseToken;
    if (!this.opened) {
      this.opened = true;
      // Somewhere it's been taken to already has its own source to show.
      const first = this.firstSource();
      if (first && this.step < 0 && step === null)
        await this.selectSource(first.id);
    }
    // It can have been taken somewhere newer while that loaded, which is where it stays.
    if (this.shown && token === this.pauseToken)
      this.followPlayhead(ms, { step, scrubbing, call });
  }

  hide() {
    this.shown = false;
  }

  /** The recording can give back its native process while its indexed/UI state
   *  stays. Object and frame IDs belong to that process, so reacquire the pause
   *  on return without moving the playhead or discarding breakpoints. */
  processReleased() {
    this.pauseToken++;
    this.engineStep = -1;
    this.pause = null;
    this.memoryNotice = null;
    this.scopesStale = true;
    this.scopesChanged();
  }

  /** For asking something at the moment you're on with no panel showing: gets there, however long that takes. */
  async catchUp(ms: number, step: number | null) {
    const map = this.map;
    if (!map) return;
    this.playheadMs = ms;
    this.scrubbing = false;
    if (this.outsideWindow(ms)) {
      this.setPlayhead(ms);
      return;
    }
    await map.whenReadyAt(ms);
    const position = step === null ? map.positionAt(ms) : { step, idle: null };
    if (
      position.step !== this.step ||
      position.idle?.kind !== this.idle?.kind ||
      !this.pause ||
      this.pause.readAhead
    )
      await this.moveTo(position.step, position.idle);
  }

  /** The timeline's marks for breakpoint hits, logpoint hits and console messages. */
  publishMarks() {
    const { map, summary } = this;
    if (!map || !summary) return;
    const enabled = [...this.breakpoints.values()].filter((bp) => bp.enabled);
    const hitTimes = (list: Breakpoint[]) =>
      list
        .flatMap((bp) =>
          markedSteps(bp.hits || []).map((step) => map.approxTimeOf(step)!),
        )
        .filter((t) => t !== undefined);
    this.timelineMarks = {
      breakpoints: hitTimes(enabled.filter((bp) => bp.logpoint === null)),
      logpoints: hitTimes(enabled.filter((bp) => bp.logpoint !== null)),
      console: summary.consoleMessages
        .map((m) => map.approxTimeOf(m.step)!)
        .filter((t) => t !== undefined),
      stops: (summary.simulation?.stops ?? [])
        .filter((stop) => !stop.error)
        .map((stop) => map.approxTimeOf(stop.step)!)
        .filter((t) => t !== undefined),
      errorStops: (summary.simulation?.stops ?? [])
        .filter((stop) => stop.error)
        .map((stop) => map.approxTimeOf(stop.step)!)
        .filter((t) => t !== undefined),
    };
    this.host.onMarks(this.timelineMarks);
    this.changed();
  }

  onEvent(event: { type: string; [key: string]: unknown }) {
    if (this.disposed) return;
    if (event.type === 'window-progress') {
      this.windowText = (event.text as string | null) ?? null;
      this.changed();
    } else if (event.type === 'whole-progress') {
      this.wholeProgress = event.fraction as number;
      this.changed();
    } else if (event.type === 'replay-progress') {
      this.replayProgress = event.fraction as number | null;
      this.changed();
    } else if (event.type === 'memory-status') {
      this.memoryNotice = event.notice as typeof this.memoryNotice;
      this.changed();
    } else if (event.type === 'logpoint-hit') {
      const hit = event as unknown as LogpointHit;
      const run = [...this.logpointResults.values()].find(
        (r) => r.run === hit.id,
      );
      if (!run) return;
      run.entries.push(hit);
      this.logpointsChangedSoon();
    } else if (event.type === 'pretty-print') {
      this.prettyPrintFinished(
        event as unknown as {
          sourceId: string;
          state: PrettyState;
          error?: string;
        },
      );
    } else if (event.type === 'devtools-clients') {
      this.devToolsClients = event.count as number;
      this.changed();
    } else if (event.type === 'devtools-paused' && this.map) {
      this.devToolsSeq = event.seq as number;
      this.host.onDevToolsPause?.(event.step as number);
    } else if (event.type === 'devtools-ended' && this.map) {
      this.devToolsSeq = event.seq as number;
      this.host.onDevToolsEnded?.();
    } else if (event.type === 'devtools-moved') {
      this.devToolsSeq = event.seq as number;
    }
  }

  /** DevTools follows the playhead once it settles. Saying which of its pauses this has heard of lets it ignore reports
   *  that crossed with its next move. */
  private reportToDevTools() {
    if (!this.devToolsClients) return;
    clearTimeout(this.devToolsTimer);
    this.devToolsTimer = setTimeout(() => {
      if (this.scrubbing) return;
      this.host.devTools?.playhead({
        step: this.step,
        idle: Boolean(this.idle),
        seq: this.devToolsSeq,
      });
    }, DevToolsFollowDelayMs);
  }

  /** Only what's in fetched pages, since a time without one doesn't land on an exact step, and where a pixel covers more
   *  than that the exact step can't be known until a drag gets there. */
  readAhead(times: Iterable<number>) {
    const { map } = this;
    if (!map) return;
    const steps = new Set<number>();
    for (const ms of times) {
      if (!map.isLoadedAt(ms)) continue;
      const { step, idle } = map.positionAt(ms);
      if (step >= 0 && !idle) steps.add(step);
    }
    this.host.readAhead([...steps]);
  }

  /* ── Sources ── */

  /** A minified source and its pretty printed source are one row. Code the recording's own author wrote comes first, with
   *  the rest folded away. */
  sourceRows() {
    const active = this.rawOf(this.sourceId);
    const shown = (this.summary?.sources ?? []).filter(
      (s) => !s.prettyOf && (!s.internal || s.id === active),
    );
    return {
      active,
      own: shown.filter((s) => !s.framework && !s.generated),
      rest: shown.filter((s) => s.framework || s.generated),
    };
  }

  loadSource(id: string) {
    let load = this.sourceLoads.get(id);
    if (!load) {
      load = this.host.loadSource(id).then((source) => {
        if (!this.disposed) this.sources.set(id, source);
        return source;
      });
      load.catch(() => this.sourceLoads.delete(id));
      this.sourceLoads.set(id, load);
    }
    return load;
  }

  /** Show a source. Of several asked for while they load, the last one's the one shown. */
  async selectSource(id: string, { line }: { line?: number } = {}) {
    if (this.disposed) return;
    const selection = ++this.selection;
    await this.waitForPrettyPrint(id);
    if (selection !== this.selection) return;
    const shown = this.shownSourceId(id);
    // A drag doesn't load a raw source that's about to be replaced. The editor catches up when the pretty printed one is
    // ready, or when the drag ends.
    if (
      this.scrubbing &&
      !this.sources.has(shown) &&
      this.prettyStates.get(this.rawOf(id)!) === 'formatting'
    ) {
      this.marksChanged();
      return;
    }
    await this.loadSource(shown);
    if (selection !== this.selection) return;
    if (this.sourceId !== shown) {
      this.sourceId = shown;
      this.changed();
    }
    this.marksChanged();
    // A line of the raw source doesn't say where to go in the pretty printed one. What asked for it gets the new position
    // from refreshLocations.
    if (line && shown === id) this.scrollToLine(line);
  }

  /** The source a pretty printed source was made from, or the source itself. */
  rawOf(id: string | null) {
    if (id === null) return null;
    return this.sourceEntries.get(id)?.prettyOf || id;
  }

  /** Which of a minified source and its pretty printed source is the one to show. */
  shownSourceId(id: string) {
    const raw = this.rawOf(id)!;
    const pretty = this.sourceEntries.get(raw)?.pretty;
    if (!pretty) return id;
    return this.prettyStates.get(raw) === 'ready' && !this.rawViews.has(pretty)
      ? pretty
      : raw;
  }

  /** A location, in the source being shown for it. Everything showing a location goes through this, so looking at a
   *  source raw changes all of them. */
  viewed(location: Location | null | undefined) {
    return location?.raw && this.rawViews.has(location.sourceId)
      ? location.raw
      : (location ?? null);
  }

  /** Have a minified source pretty printed, and give that a moment. A drag doesn't wait. */
  private async waitForPrettyPrint(id: string) {
    const raw = this.rawOf(id)!;
    const pretty = this.sourceEntries.get(raw)?.pretty;
    if (
      !pretty ||
      this.rawViews.has(pretty) ||
      ['ready', 'failed'].includes(this.prettyStates.get(raw) ?? '')
    )
      return;
    if (!this.prettyStates.has(raw)) {
      const state = await this.host.prettyPrint(raw);
      // It could have finished before this got back, in which case that's known.
      if (!this.prettyStates.has(raw)) this.prettyStates.set(raw, state);
      if (state === 'ready' && this.prettyStates.get(raw) === 'ready')
        this.background(this.refreshLocations());
    }
    if (this.scrubbing || this.prettyStates.get(raw) !== 'formatting') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, PrettyPrintWaitMs);
      if (!this.prettyWaiting.has(raw)) this.prettyWaiting.set(raw, []);
      this.prettyWaiting.get(raw)!.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private prettyPrintFinished({
    sourceId,
    state,
    error,
  }: {
    sourceId: string;
    state: PrettyState;
    error?: string;
  }) {
    this.prettyStates.set(sourceId, state);
    for (const resolve of this.prettyWaiting.get(sourceId) || []) resolve();
    this.prettyWaiting.delete(sourceId);
    if (error) this.prettyErrors = { ...this.prettyErrors, [sourceId]: error };
    if (!this.summary) return;
    if (state === 'ready') this.background(this.refreshLocations());
    else this.changed();
  }

  /** Positions in a source that's just been pretty printed are shown differently now, wherever they are. They all arrive
   *  together, however many sources finish at once. */
  async refreshLocations() {
    this.refreshAgain = this.refreshing;
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      do {
        this.refreshAgain = false;
        await this.updateLocations();
      } while (this.refreshAgain);
    } finally {
      this.refreshing = false;
    }
  }

  private async updateLocations() {
    const token = this.pauseToken;
    type Held = { location?: Location | null };
    const held: Held[] = [
      ...((this.summary?.consoleMessages ?? []) as Held[]),
      ...[...this.logpointResults.values()].flatMap((r) =>
        r.entries.map((e) => e.step as Held),
      ),
    ].filter((x) => x?.location);
    const frames: StackFrame[] = [
      ...(this.pause?.frames || []),
      ...this.stackPreview,
    ];
    const asked = [
      ...held.map((x) => x.location!),
      ...frames.flatMap((f) => (f.location || []) as Location[]),
    ];
    const [peeked, shown] = await Promise.all([
      this.step >= 0 ? this.host.peek(this.step) : null,
      this.host.shownLocations(asked),
    ]);
    let next = 0;
    for (const x of held) x.location = shown[next++];
    for (const f of frames) f.location = f.location?.map(() => shown[next++]);
    const before = this.stepInfo?.location;
    // A move since this started has newer positions than these.
    if (peeked && token === this.pauseToken) {
      this.stepInfo = peeked.step;
      if (!this.pause?.frames?.length)
        this.stackPreview = this.idle ? [] : stackFrom(peeked.stack);
    }
    const after = this.stepInfo?.location;
    const loc = this.viewed(after);
    const dragging =
      this.scrubbing && loc && this.isFrameworkSource(loc.sourceId);
    if (loc && !dragging && before?.sourceId !== after?.sourceId) {
      await this.selectSource(loc.sourceId, { line: loc.line });
    } else if (
      this.sourceId &&
      this.shownSourceId(this.sourceId) !== this.sourceId
    ) {
      await this.selectSource(this.shownSourceId(this.sourceId));
    }
    this.marksChanged();
    this.logpointsChangedSoon();
  }

  /** Look at a source raw or pretty printed, staying on the current line if it's there. */
  async setRawView(prettyId: string, raw: boolean) {
    if (raw) this.rawViews.add(prettyId);
    else this.rawViews.delete(prettyId);
    const shown = this.shownSourceId(prettyId);
    const loc = this.viewed(this.stepInfo?.location);
    await this.selectSource(
      shown,
      loc?.sourceId === shown ? { line: loc.line } : {},
    );
    this.marksChanged();
    this.logpointsChangedSoon();
  }

  /** What the code's title says about how it's being shown. */
  titleFormat(): {
    text: string;
    title: string;
    toggle?: { label: string; title: string; press: () => void };
  } | null {
    const source = this.sourceId ? this.sources.get(this.sourceId) : null;
    if (!source) return null;
    const raw = this.rawOf(source.id)!;
    const pretty = this.sourceEntries.get(raw)?.pretty;
    const state = this.prettyStates.get(raw);
    if (source.prettyOf) {
      return {
        text: 'Pretty printed',
        title:
          "This source is minified, so it's shown pretty printed. Lines are the pretty printed ones, here and everywhere else",
        toggle: {
          label: 'Show raw',
          title: 'Show the source as it was recorded',
          press: () => void this.setRawView(source.id, true),
        },
      };
    }
    if (pretty && state === 'ready') {
      return {
        text: 'Raw',
        title:
          'This is the source as it was recorded. Lines are its own, here and everywhere else',
        toggle: {
          label: 'Pretty print',
          title: 'Show this source pretty printed',
          press: () => void this.setRawView(pretty, false),
        },
      };
    }
    if (pretty && state === 'failed')
      return {
        text: "Couldn't pretty print",
        title: this.prettyErrors[raw] || '',
      };
    if (pretty) return { text: 'Pretty printing…', title: '' };
    return null;
  }

  isFrameworkSource(id: string | undefined) {
    return Boolean(id && this.sourceEntries.get(id)?.framework);
  }

  /** Bring a line of the source being shown into view. */
  scrollToLine(line: number) {
    this.scrollRequest = { line, seq: ++this.scrollSeq };
    this.changed();
  }

  /* ── Lines ── */

  private marksChanged() {
    this.marksVersion++;
    this.changed();
  }

  /** The line being run, in the source being shown. */
  currentLocation() {
    const loc = this.viewed(this.stepInfo?.location);
    return loc && loc.sourceId === this.sourceId
      ? { line: loc.line, column: loc.column, ran: Boolean(this.idle) }
      : null;
  }

  /** The line of the frame that's selected, if that isn't the top one, in the source being shown. */
  frameLine() {
    if (this.selectedFrame <= 0) return null;
    const frame = this.stackFrames()[this.selectedFrame];
    const loc = this.viewed(frame?.location?.[0]);
    return loc && loc.sourceId === this.sourceId ? loc.line : null;
  }

  /** Under lines with an open navigator or a logpoint, in the source being shown. */
  linePanels(): LinePanel[] {
    const panels: LinePanel[] = [];
    const wanted = new Map<string, { sourceId: string; line: number }>(
      [...this.openNavigators].filter(([, n]) => n.sourceId === this.sourceId),
    );
    for (const [key, bp] of this.breakpoints)
      if (bp.sourceId === this.sourceId && bp.logpoint !== null)
        wanted.set(key, bp);
    for (const [key, { line, sourceId }] of wanted)
      panels.push({
        key,
        line,
        sourceId,
        logpoint: this.breakpoints.get(key)?.logpoint != null,
      });
    return panels.sort((a, b) => a.line - b.line);
  }

  async toggleBreakpoint(
    line: number,
    { logpoint = false }: { logpoint?: boolean } = {},
  ) {
    const sourceId = this.sourceId!;
    const key = `${sourceId}:${line}`;
    const existing = this.breakpoints.get(key);
    if (existing && (!logpoint || existing.logpoint !== null)) {
      this.breakpoints.delete(key);
      this.logpointResults.delete(key);
    } else {
      const bp: Breakpoint = existing || {
        sourceId,
        line,
        enabled: true,
        logpoint: null,
        hits: [],
      };
      if (logpoint)
        bp.logpoint = defaultLogpoint(
          lineOf(this.sources.get(sourceId), line),
          line,
        );
      this.breakpoints.set(key, bp);
      this.marksChanged();
      bp.hits = await this.hitsFor(bp.sourceId, line);
      if (bp.logpoint !== null) void this.runLogpoint(key);
    }
    this.marksChanged();
    this.host.onLogpoints?.();
    this.publishMarks();
  }

  /** A line's executions never change, so they're only fetched once. */
  async hitsFor(sourceId: string, line: number) {
    const key = `${sourceId}:${line}`;
    if (!this.lineHits.has(key))
      this.lineHits.set(key, await this.host.hitsToShow(sourceId, line));
    return this.lineHits.get(key)!;
  }

  /** Jump to the line's next execution after the current point, or to its last one if it doesn't run again. */
  async jumpToLine(line: number) {
    const hits = await this.hitsFor(this.sourceId!, line);
    if (!hits.length) return;
    const after = hitAfter(hits, this.step);
    const target = hitStep(
      hits,
      after < hits.length ? after : hits.length - 1,
    )!;
    if (target === this.step)
      this.host.status(`This is the last execution of line ${line}`);
    else await this.pauseAt(target);
  }

  /** Open or close a line's panel. A logpoint's panel stays open for as long as the logpoint exists. */
  async toggleNavigator(line: number) {
    const sourceId = this.sourceId!;
    const key = `${sourceId}:${line}`;
    const logpoint = this.breakpoints.get(key)?.logpoint != null;
    if (this.openNavigators.has(key) && !logpoint) {
      this.openNavigators.delete(key);
      this.marksChanged();
      return;
    }
    await this.hitsFor(sourceId, line);
    this.openNavigators.set(key, { sourceId, line });
    this.focusPanel = { key, seq: ++this.scrollSeq };
    this.marksChanged();
  }

  /** A panel that's just opened takes the focus, ready for typing. */
  focusPanel: { key: string; seq: number } | null = null;

  async runLogpoint(key: string) {
    const bp = this.breakpoints.get(key);
    if (!bp) return;
    const run = ++this.logpointRun;
    const results: LogpointResults = { run, entries: [], info: null };
    this.logpointResults.set(key, results);
    this.marksChanged();
    this.host.onLogpoints?.();
    try {
      results.info = await this.host.logpoint(
        run,
        bp.sourceId,
        bp.line,
        bp.logpoint!,
      );
    } catch (e) {
      results.info = { error: (e as Error).message };
    }
    if (this.logpointResults.get(key) === results) {
      this.marksChanged();
      this.host.onLogpoints?.();
    }
  }

  /** The expression changed in the panel, so it runs again. Nothing at all logs that it was hit. */
  setLogpoint(key: string, expression: string) {
    const bp = this.breakpoints.get(key);
    if (!bp) return;
    bp.logpoint = expression.trim() || '"hit"';
    void this.runLogpoint(key);
  }

  setBreakpointEnabled(key: string, enabled: boolean) {
    const bp = this.breakpoints.get(key);
    if (!bp) return;
    bp.enabled = enabled;
    this.marksChanged();
    this.host.onLogpoints?.();
    this.publishMarks();
  }

  enabledBreakpointLines() {
    return [...this.breakpoints.values()]
      .filter((bp) => bp.enabled && bp.logpoint === null)
      .map(({ sourceId, line }) => ({ sourceId, line }));
  }

  /** A breakpoint belongs to the lines it was set on, so it's the source those are in that gets shown, raw or pretty printed. */
  async goToBreakpoint({ sourceId, line }: { sourceId: string; line: number }) {
    const { pretty, prettyOf } = this.sourceEntries.get(sourceId) || {};
    if (pretty || prettyOf) await this.setRawView(pretty || sourceId, !!pretty);
    await this.selectSource(sourceId, { line });
  }

  removeBreakpoint(key: string) {
    this.breakpoints.delete(key);
    this.logpointResults.delete(key);
    this.marksChanged();
    this.host.onLogpoints?.();
    this.publishMarks();
  }

  /** The arrows of a line's navigator work out their target when they're pressed, so quick presses add up even while a
   *  pause is still loading. */
  hitBefore(hits: Hits) {
    return hitAfter(hits, this.step - 1) - 1;
  }

  hitNext(hits: Hits) {
    const at = hitAfter(hits, this.step);
    return at < hits.length ? at : -1;
  }

  goToHit(hits: Hits, i: number) {
    const step = hitStep(hits, i);
    if (step !== undefined) void this.pauseAt(step);
  }

  /** The number to show for where this is among a line's executions, if it's on one. */
  hitPosition(hits: Hits) {
    const at = hitAfter(hits, this.step - 1);
    return hitStep(hits, at) === this.step ? at + 1 : null;
  }

  /* ── Pausing and navigation ── */

  async navigate(how: NavigationKind) {
    if (!this.summary) return;
    // When no JS is running, going back starts with the last step that ran.
    if (this.idle && this.step >= 0 && how.endsWith('Back'))
      return this.pauseAt(this.step);
    const next = await this.host.navigate(
      this.step,
      how,
      this.enabledBreakpointLines(),
    );
    if (await this.host.crossWithStep?.(how, next)) return;
    // Off the end of this part of a very long recording, it goes on in the next. Nothing's on the stack there, so
    // whichever kind of step it was, that's where it lands.
    if (
      next < 0 &&
      this.summary.window &&
      how !== 'continue' &&
      how !== 'rewind'
    ) {
      const across = await this.host.stepAcross?.(
        how.endsWith('Back') ? -1 : 1,
      );
      if (across !== undefined && across >= 0) return this.pauseAt(across);
    }
    if (next < 0) {
      this.host.status(
        how.endsWith('Back') || how === 'rewind'
          ? 'Already at the start of execution'
          : 'Reached the end of execution',
      );
      return;
    }
    await this.pauseAt(next);
  }

  /** Go to a step from the debugger, taking the playhead with it. */
  async pauseAt(step: number) {
    if (this.disposed) return;
    ++this.playheadRequest;
    const map = this.map!;
    await map.ensureStep(step);
    if (this.disposed) return;
    const ms = map.timeOf(step)!;
    this.playheadMs = ms;
    this.scrubbing = false;
    this.host.onStep(step, ms);
    this.reportToDevTools();
    await this.moveTo(step, null);
  }

  /** Choose whether automatic timeline seeks include dependency code. Exact links stay exact. */
  setApplicationCodeOnly(enabled: boolean) {
    ++this.playheadRequest;
    this.applicationCodeOnly = enabled;
    this.applicationCodeUnavailable = false;
    this.changed();
    const ms = this.playheadMs;
    if (ms !== null && this.map?.isLoadedAt(ms)) {
      const position = this.map.positionAt(ms);
      this.background(this.moveTo(position.step, position.idle, enabled));
    }
  }

  /** Follow the playhead to a time. Explicit steps and call selections remain exact. */
  setPlayhead(
    ms: number,
    {
      scrubbing = false,
      step = null,
      call = null,
    }: { scrubbing?: boolean; step?: number | null; call?: number | null } = {},
  ) {
    const alignPlayhead = this.scrubbing && !scrubbing;
    this.followPlayhead(ms, { scrubbing, step, call }, alignPlayhead);
  }

  /** Only releasing a scrub may align the shared clock to a nearby application pause. */
  private followPlayhead(
    ms: number,
    {
      scrubbing,
      step,
      call,
    }: { scrubbing: boolean; step: number | null; call: number | null },
    alignPlayhead = false,
  ) {
    if (this.disposed) return;
    const request = ++this.playheadRequest;
    this.playheadMs = ms;
    this.scrubbing = scrubbing;
    const { map } = this;
    if (!map) return;
    // Somewhere that isn't indexed yet, on a very long recording. A drag doesn't wait for it, and when it stops, it's asked for.
    if (this.outsideWindow(ms)) {
      this.pauseToken++;
      this.idle = { kind: 'elsewhere' };
      this.pause = null;
      this.stepInfo = null;
      this.stackPreview = [];
      this.changed();
      if (!scrubbing && this.host.openWindowAt)
        this.background(this.host.openWindowAt(ms));
      return;
    }
    // Just this once it can't say where this is, and it won't be long.
    const ready = step === null ? map.whenReadyAt(ms, call) : null;
    if (ready) {
      this.background(
        ready.then(() => {
          if (this.playheadMs !== ms || request !== this.playheadRequest)
            return;
          this.followPlayhead(ms, { scrubbing, step, call }, alignPlayhead);
        }),
      );
      return;
    }
    const position =
      step === null ? { ...map.positionAt(ms) } : { step, idle: null };
    // Calls can share an estimated time, so a main thread call says which step it is. Whether JS was running goes by the time.
    if (call !== null) position.step = map.stepForCall(call);
    const moved =
      position.step !== this.step ||
      position.idle?.kind !== this.idle?.kind ||
      position.idle?.nextStep !== this.idle?.nextStep;
    const preferApplication =
      step === null && call === null && this.applicationCodeOnly;
    const currentSource = this.sourceEntries.get(
      this.stepInfo?.location?.sourceId ?? '',
    );
    const dependency =
      currentSource?.framework ||
      currentSource?.internal ||
      currentSource?.generated;
    if (!scrubbing) this.reportToDevTools();
    if (
      moved ||
      (preferApplication &&
        (dependency || this.stepInfo?.index !== position.step))
    ) {
      this.background(
        this.moveTo(
          position.step,
          position.idle,
          preferApplication,
          alignPlayhead,
        ),
      );
    } else if (position.idle) {
      this.idle = position.idle;
      this.changed();
    } else if (!scrubbing) {
      // A drag ended here, so the engine can catch up. Coming back to the same step isn't a drag, and whatever's been opened
      // since, another source or another frame's, stays open.
      this.settle(alignPlayhead);
    }
  }

  /** Nothing's moving now, so what wasn't worth loading on the way is. */
  settle(showSource = true) {
    if (this.step < 0 || this.idle || this.applicationCodeUnavailable) return;
    const loc = this.viewed(this.stepInfo?.location);
    if (showSource && loc && this.shownSourceId(loc.sourceId) !== this.sourceId)
      this.background(this.selectSource(loc.sourceId, { line: loc.line }));
    if (this.pause?.readAhead || (!this.pause && this.engineStep !== this.step))
      this.background(this.loadFromEngine(this.step, this.pauseToken));
  }

  /** Show a step: its line and call stack straight away from the scan, then frames and scopes from the engine. `idle` is
   *  set when no JS is on the stack, with the step being the last one that ran. */
  async moveTo(
    step: number,
    idle: IdleInfo | null,
    preferApplication = false,
    alignPlayhead = false,
  ) {
    const token = ++this.pauseToken;
    const request = this.playheadRequest;
    this.applicationCodeUnavailable = false;
    if (preferApplication && step >= 0 && this.host.applicationStepNear) {
      const requested = step;
      step = await this.host.applicationStepNear(step);
      if (
        token !== this.pauseToken ||
        request !== this.playheadRequest ||
        this.disposed
      )
        return;
      if (step < 0) {
        this.step = requested;
        this.idle = null;
        this.stepInfo = null;
        this.pause = null;
        this.stackPreview = [];
        if (this.sourceId && this.isFrameworkSource(this.sourceId)) {
          this.sourceId = null;
          ++this.selection;
        }
        this.applicationCodeUnavailable = true;
        this.scopesStale = false;
        this.scopesChanged();
        this.changed();
        return;
      }
      if (step !== requested) idle = null;
      if (step !== requested && alignPlayhead && !this.scrubbing) {
        await this.map?.ensureStep(step);
        if (
          token !== this.pauseToken ||
          request !== this.playheadRequest ||
          this.disposed
        )
          return;
        const ms = this.map?.timeOf(step);
        if (ms !== undefined) {
          this.playheadMs = ms;
          this.host.onStep(step, ms);
        }
      }
    }
    this.step = step;
    this.idle = idle;
    // What was paused belonged to the last step. Evaluating with it would ask this one about its frames.
    this.pause = null;
    const peeked = step >= 0 ? await this.host.peek(step) : null;
    if (token !== this.pauseToken) return;
    this.stepInfo = peeked?.step || null;
    this.stackPreview = idle || !peeked ? [] : stackFrom(peeked.stack);
    this.pause =
      !idle && peeked?.values
        ? this.pauseFrom(peeked.values, { readAhead: true })
        : null;
    this.selectedFrame = 0;
    const loc = this.viewed(this.stepInfo?.location);
    // A drag through framework code leaves the editor on the code being debugged, rather than flipping through bundles on
    // the way past. Nor does a drag wait for a source to load: the editor catches up when it's here, or when the drag ends.
    if (loc && !(this.scrubbing && this.isFrameworkSource(loc.sourceId))) {
      const selected = this.selectSource(loc.sourceId, { line: loc.line });
      if (
        !this.scrubbing ||
        this.sources.has(this.shownSourceId(loc.sourceId))
      ) {
        await selected;
        if (token !== this.pauseToken) return;
      } else {
        selected.catch(() => {});
        this.marksChanged();
      }
    } else {
      this.marksChanged();
    }
    this.scopesError = null;
    if (!this.scrubbing) this.background(this.loadCalls(token));
    if (idle || step < 0) {
      this.scopesStale = false;
      this.scopesChanged();
      return;
    }
    // The drag can end at any point up to here, so this asks whether it's still going rather than whether it was when this
    // move started.
    if (this.pause) {
      this.scopesStale = false;
      this.background(this.loadScopes());
      if (this.scrubbing) return;
    } else {
      this.scopesStale = true;
      this.scopesChanged();
      if (this.scrubbing && step < this.engineStep) {
        await new Promise((resolve) =>
          setTimeout(resolve, BackwardDragDelayMs),
        );
        if (token !== this.pauseToken) return;
      }
    }
    await this.loadFromEngine(step, token);
  }

  /** Get a step's frames and values from the live engine process, which can then expand objects and evaluate there. */
  private async loadFromEngine(step: number, token: number) {
    this.engineStep = step;
    const started = this.now();
    let result;
    try {
      result = await this.host.pause(step);
    } catch (e) {
      if (token === this.pauseToken) {
        this.scopesStale = false;
        this.scopesError = (e as Error).message;
        this.scopesChanged();
      }
      return;
    }
    if (token !== this.pauseToken || result.superseded) return;
    this.pause = this.pauseFrom(result.frames.data || {}, {
      ms: this.now() - started,
      tooEarly: result.frames.tooEarly,
    });
    this.scopesStale = false;
    this.marksChanged();
    this.background(this.loadScopes());
    this.background(this.loadCalls(token));
  }

  private pauseFrom(data: PauseData, details: Partial<Pause>): Pause {
    const pause: Pause = {
      frames: data.frames || [],
      objects: new Map(),
      scopes: new Map(),
      ...details,
    };
    this.addPauseData(data, pause);
    return pause;
  }

  /** The system calls the current step made, when it made any. */
  private async loadCalls(token: number) {
    const { map, host } = this;
    if (!map || !host.calls) return;
    if (!this.idle && this.step >= 0) await map.ensureStep(this.step);
    if (token !== this.pauseToken) return;
    const { from, to } =
      this.idle || this.step < 0
        ? { from: 0, to: 0 }
        : map.callsFromStep(this.step);
    const rows =
      to > from
        ? (await host.calls(from, Math.min(to - from, CallListLimit))).rows
        : [];
    if (token !== this.pauseToken) return;
    this.calls = { rows, more: to - from - rows.length };
    this.changed();
  }

  addPauseData(data: PauseData | undefined, pause: Pause | null = this.pause) {
    if (!pause || !data) return;
    for (const o of data.objects || []) {
      const existing = pause.objects.get(o.objectId);
      if (
        !existing ||
        (o.preview && !existing.preview) ||
        (o.preview && !o.preview.overflow)
      )
        pause.objects.set(o.objectId, o);
    }
    for (const s of data.scopes || []) pause.scopes.set(s.scopeId, s);
  }

  /** The call stack: the engine's frames once they're here, the scan's until then. */
  stackFrames(): StackFrame[] {
    return this.pause?.frames?.length ? this.pause.frames : this.stackPreview;
  }

  async selectFrame(i: number) {
    this.selectedFrame = i;
    this.changed();
    const loc = this.viewed(this.stackFrames()[i]?.location?.[0]);
    if (loc && this.sourceEntries.has(loc.sourceId))
      await this.selectSource(loc.sourceId, { line: loc.line });
    this.marksChanged();
    this.background(this.loadScopes());
  }

  /** The selected frame's scopes, then a preview of what's in them. */
  private async loadScopes() {
    const pause = this.pause;
    const frame = pause?.frames?.[this.selectedFrame];
    this.scopesChanged();
    if (!frame || !pause) return;
    const step = this.step;
    // Values read ahead came from another process, so its IDs mean nothing here.
    const missing = pause.readAhead
      ? []
      : (frame.scopeChain ?? []).filter((id) => !pause.scopes.has(id));
    for (const id of missing) {
      try {
        const r = await this.host.scope(step, id);
        if (pause !== this.pause) return;
        this.addPauseData(r.data);
      } catch (e) {
        if (pause !== this.pause) return;
        this.scopesError = (e as Error).message;
        this.scopesChanged();
        return;
      }
    }
    if (missing.length) this.scopesChanged();
    if (!pause.readAhead) void this.prefetchPreviews(pause, frame);
  }

  /** The next action of a simulated seed or the one before, from where this is. Says whether there's a seed to walk at all. */
  goToStop(direction: 1 | -1) {
    const stops = this.summary?.simulation?.stops;
    if (!stops) return false;
    const stop = stopFrom(stops, this.step, direction) as SeedStop | null;
    if (stop) void this.pauseAt(stop.step);
    else
      this.host.status(
        direction > 0
          ? "That's the seed's last action"
          : "That's the seed's first action",
      );
    return true;
  }

  /** The line of JS running when a main thread call was made, or null if none was. */
  async originOfCall(index: number, timeMs: number) {
    if (!this.map) return null;
    await this.map.whenReadyAt(timeMs, index);
    if (this.map.positionAt(timeMs).idle) return null;
    const step = this.map.stepForCall(index);
    if (step < 0) return null;
    const { step: info } = await this.host.peek(step);
    const loc = this.viewed(info.location);
    const source = loc ? this.sourceEntries.get(loc.sourceId) : undefined;
    return loc
      ? `${sourceName(source)}:${loc.line}`
      : `step ${step.toLocaleString()}`;
  }

  /** Scope bindings come without object previews, so they're fetched from the paused engine, so objects show their contents. */
  private async prefetchPreviews(pause: Pause, frame: FrameData) {
    pause.prefetched = pause.prefetched || new Set();
    if (pause.prefetched.has(frame.frameId)) return;
    pause.prefetched.add(frame.frameId);
    const ids: string[] = [];
    if (frame.this?.object) ids.push(frame.this.object);
    for (const id of frame.scopeChain ?? []) {
      for (const b of pause.scopes.get(id)?.bindings || [])
        if (b.object) ids.push(b.object);
    }
    const missing = [...new Set(ids)]
      .filter((id) => !pause.objects.get(id)?.preview)
      .slice(0, PreviewsFetched);
    if (!missing.length) return;
    const step = this.step;
    for (const id of missing) {
      try {
        const r = await this.host.preview(step, id);
        if (pause !== this.pause) return;
        this.addPauseData(r.data);
      } catch {
        return;
      }
    }
    if (pause === this.pause && pause.frames[this.selectedFrame] === frame)
      this.scopesChanged();
  }

  private scopesChanged() {
    this.scopesVersion++;
    this.changed();
  }

  /** An object's whole preview, from the process that's paused here. Values read ahead have only what was kept. */
  async fetchPreview(pause: Pause, step: number, objectId: string) {
    if (pause.readAhead || pause !== this.pause)
      return pause.objects.get(objectId);
    const r = await this.host.preview(step, objectId);
    if (pause === this.pause) this.addPauseData(r.data);
    return pause.objects.get(objectId);
  }

  async evaluate(expression: string) {
    if (!this.pause || this.pause.readAhead) {
      this.host.status(
        this.idle
          ? 'No JS is running here to evaluate in'
          : 'Still replaying to this point',
      );
      return;
    }
    const pause = this.pause;
    const frame = pause.frames[this.selectedFrame];
    const entry: Evaluation = {
      expression,
      step: this.step,
      frame: frame ? frameName(frame) : '(top level)',
      result: null,
      error: null,
      pauseContext: this.pauseContext(pause),
    };
    this.evaluations = [...this.evaluations, entry];
    this.changed();
    try {
      entry.result = await this.host.evaluate(
        this.step,
        frame ? frame.frameId : null,
        expression,
      );
      entry.objects = new Map(
        (entry.result.data?.objects || []).map((o) => [o.objectId, o]),
      );
      if (this.evaluationPause(entry)) this.addPauseData(entry.result.data);
    } catch (e) {
      entry.error = (e as Error).message;
    }
    this.evaluations = [...this.evaluations];
    this.changed();
  }

  private pauseContext(pause: Pause) {
    let context = this.pauseContexts.get(pause);
    if (context === undefined) {
      context = ++this.nextPauseContext;
      this.pauseContexts.set(pause, context);
    }
    return context;
  }

  /** Evaluation history can display saved objects anywhere. Only its original
   *  live pause may fetch more; the same step in a new process has different IDs. */
  evaluationPause(entry: Evaluation) {
    const pause = this.pause;
    return pause &&
      !pause.readAhead &&
      this.pauseContext(pause) === entry.pauseContext
      ? pause
      : null;
  }

  private logpointsChangedSoon() {
    if (this.consoleTimer) return;
    this.consoleTimer = setTimeout(() => {
      this.consoleTimer = undefined;
      this.marksChanged();
      this.host.onLogpoints?.();
    }, 60);
  }

  /** What's in the way of stepping by keys is whoever else uses them, and that's for the caller to say. */
  keyToNavigation(e: {
    key: string;
    altKey: boolean;
    shiftKey: boolean;
  }): NavigationKind | null {
    if (e.key === 'F10') return e.altKey ? 'stepOverBack' : 'stepOver';
    if (e.key === 'F11' && e.shiftKey)
      return e.altKey ? 'stepOutBack' : 'stepOut';
    if (e.key === 'F11') return e.altKey ? 'stepInBack' : 'stepIn';
    if (e.key === 'F8') return e.altKey ? 'rewind' : 'continue';
    if (e.key === 'ArrowDown') return 'stepOver';
    if (e.key === 'ArrowUp') return 'stepOverBack';
    if (e.key === 'ArrowRight') return e.shiftKey ? 'stepOut' : 'stepIn';
    if (e.key === 'ArrowLeft') return e.shiftKey ? 'stepOutBack' : 'stepInBack';
    return null;
  }

  /** A line of a source, whether or not it's been split up. */
  lineText(sourceId: string, line: number) {
    return lineOf(this.sources.get(sourceId), line);
  }
}

function stackFrom(stack: PeekedFrame[]) {
  return stack.map((f) => ({ displayName: f.name, location: [f.location] }));
}

/** Lines where JS engines count them, which isn't only at a newline. */
const LineEnd = /\r\n|[\n\r\u2028\u2029]/;

function lineOf(source: LoadedSource | undefined, line: number) {
  if (!source) return undefined;
  return source.contents.split(LineEnd)[line - 1];
}
