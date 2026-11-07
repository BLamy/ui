/* ══ What a time travel debugger needs from whatever has the recording ══
   Nothing here knows about processes, IPC or files. It speaks of steps, sources, frames and values, the way a debugging
   protocol does, and a host answers: this app with a native replay engine behind it, or a demo with a table in memory. */

export type NavigationKind =
  | 'rewind'
  | 'stepOutBack'
  | 'stepOverBack'
  | 'stepInBack'
  | 'stepIn'
  | 'stepOver'
  | 'stepOut'
  | 'continue';

export interface Location {
  sourceId: string;
  line: number;
  column?: number;
  /** Where this is in the raw source, when it's shown in the pretty printed one. */
  raw?: Location;
}

export interface SourceEntry {
  id: string;
  kind?: string;
  url?: string;
  /** Replay's own scripts, which stay out of the way. */
  internal?: boolean;
  /** Generated code with a source map, which is read through its originals. */
  generated?: boolean;
  framework?: boolean;
  /** The pretty printed source this can be shown as. */
  pretty?: string;
  /** The minified source this was pretty printed from. */
  prettyOf?: string;
}

export interface LoadedSource extends SourceEntry {
  contents: string;
  breakableLines: number[];
  /** How many times each line ran, by line number. */
  hitCounts: Record<number, number>;
}

export interface StepInfo {
  index: number;
  progress: number;
  location: Location | null;
}

/** When no JS is on the stack. `step` is then the last one that ran. */
export interface IdleInfo {
  /** `elsewhere`: the playhead's in a part of a very long recording that isn't what's indexed here. */
  kind: 'before' | 'between' | 'after' | 'none' | 'elsewhere';
  nextMs?: number;
  nextStep?: number;
}

/** Protocol values: `{ value }`, `{ object }`, `{ unserializableNumber }`, `{ bigint }`, `{ symbol }`, `{ uninitialized }`,
 *  `{ unavailable }`, `{ get, set }`, or nothing for undefined. */
export interface ProtocolValue {
  value?: unknown;
  object?: string;
  unserializableNumber?: string;
  bigint?: string;
  symbol?: string;
  uninitialized?: boolean;
  unavailable?: boolean;
  get?: unknown;
  set?: unknown;
}

export interface PropertyData extends ProtocolValue {
  name: string;
  flags?: number;
}

export interface ObjectPreview {
  overflow?: boolean;
  properties?: PropertyData[];
  containerEntries?: { key?: ProtocolValue; value: ProtocolValue }[];
  containerEntryCount?: number;
  getterValues?: PropertyData[];
  functionName?: string;
  functionParameterNames?: string[];
  functionLocation?: Location[];
  regexpString?: string;
  dateTime?: number;
  node?: {
    nodeName?: string;
    attributes?: { name: string; value: string }[];
    nodeType?: number;
  };
}

export interface ObjectData {
  objectId: string;
  className?: string;
  preview?: ObjectPreview;
}

export interface ScopeData {
  scopeId: string;
  type: string;
  functionName?: string;
  bindings?: (ProtocolValue & { name: string })[];
  object?: string;
}

export interface FrameData {
  frameId: string;
  functionName?: string;
  displayName?: string;
  type?: string;
  location?: Location[];
  scopeChain?: string[];
  this?: ProtocolValue;
}

export interface PauseData {
  frames?: FrameData[];
  objects?: ObjectData[];
  scopes?: ScopeData[];
}

export interface PeekedFrame {
  name: string;
  location: Location | null;
}

export interface Peek {
  step: StepInfo;
  stack: PeekedFrame[];
  /** What a read ahead kept for this step, if it did. */
  values: PauseData | null;
}

export type PauseResult =
  | { superseded: true }
  | { superseded?: false; frames: { data?: PauseData; tooEarly?: boolean } };

/** A line's executions: one object per step, or just the steps on a line that's run a lot. In order, either way. */
export type Hits = StepInfo[] | Float64Array;

export interface EvaluationResult {
  returned?: ProtocolValue;
  exception?: ProtocolValue;
  failed?: boolean;
  data?: PauseData;
}

export type DataAnswer =
  | { superseded: true; data?: undefined }
  | { superseded?: false; data?: PauseData };

export interface LogpointHit {
  id: number;
  step: StepInfo;
  result?: EvaluationResult;
  error?: string;
}

export interface LogpointInfo {
  count?: number;
  total?: number;
  error?: string | null;
}

export type PrettyState = 'formatting' | 'ready' | 'failed' | 'none';

export interface CallRow {
  index: number;
  name: string;
  summary: string;
}

/** The whole recording's index, as it comes when it's built. */
/** What a simulated seed's recording says about itself, from src/sim/stops.js: each action a place, by its step. */
export interface SeedStop {
  index: number;
  name: string;
  label: string;
  step: number;
  error: boolean;
}

export interface SeedSummary {
  seed: number | null;
  stops: SeedStop[];
  finished: boolean;
  violation: {
    kind: string;
    message: string;
    step: number;
    by: string | null;
  } | null;
}

export interface DebuggerSummary {
  runtime: string;
  /** Optional host-supplied backend description, such as an in-memory demo or a replay service. */
  engineLabel?: string;
  sources: SourceEntry[];
  consoleMessages: { step: number; location?: Location | null }[];
  steps: number;
  firstStep: number;
  lastStep: number;
  timeline: { warning?: string | null };
  simulation?: SeedSummary | null;
  /** Which part of the recording this is, if it's too big to all be here. Steps are numbered within it. */
  window?: {
    number: number;
    of: number;
    startMs: number;
    endMs: number;
  } | null;
}

/** Moves between the playhead's time and steps, for a recording of any length: a step's time may need fetching, but only
 *  ever once, and the answer's near enough until then. */
export interface StepClock {
  positionAt(ms: number): {
    step: number;
    idle: IdleInfo | null;
    approximate?: boolean;
  };
  timeOf(step: number): number | undefined;
  approxTimeOf(step: number): number | undefined;
  /** Null when it can say straight away. */
  whenReadyAt(ms: number, call?: number | null): Promise<unknown> | null;
  ensureStep(step: number): Promise<unknown> | null | undefined;
  isLoadedAt(ms: number): boolean;
  callsFromStep(step: number): { from: number; to: number };
  stepForCall(index: number): number;
}

export interface TimelineMarks {
  breakpoints: number[];
  logpoints: number[];
  console: number[];
  stops?: number[];
  errorStops?: number[];
}

/** Something to press that goes somewhere from the moment you're on: a request this step is part of, and its other end. */
export interface StepLink {
  id: string;
  label: string;
  title: string;
  onPress: () => void;
}

export type StatusOptions = { error?: boolean; sticky?: boolean };

export interface DevToolsReply {
  webSocketUrl: string;
  opened?: boolean | string;
  message?: string;
}

export interface DebuggerHost {
  /* What's known about a step without paying for a replay. */
  peek(step: number): Promise<Peek>;
  /** Nearest application pause in this indexed window; -1 when it has none. */
  applicationStepNear?(step: number): Promise<number>;
  navigate(
    from: number,
    how: NavigationKind,
    breakpoints: { sourceId: string; line: number }[],
  ): Promise<number>;
  loadSource(id: string): Promise<LoadedSource>;
  prettyPrint(id: string): Promise<PrettyState>;
  shownLocations(locations: Location[]): Promise<Location[]>;
  hitsToShow(sourceId: string, line: number): Promise<Hits>;
  /** The system calls between two of the recording's calls, if it has any to say. */
  calls?(from: number, count: number): Promise<{ rows: CallRow[] }>;

  /* What takes replaying to the step. */
  pause(step: number): Promise<PauseResult>;
  scope(step: number, scopeId: string): Promise<DataAnswer>;
  preview(step: number, objectId: string): Promise<DataAnswer>;
  evaluate(
    step: number,
    frameId: string | null,
    expression: string,
  ): Promise<EvaluationResult>;
  /** Runs an expression at each of a line's hits, saying so through `onLogpointHit` on the model as it goes. */
  logpoint(
    run: number,
    sourceId: string,
    line: number,
    expression: string,
  ): Promise<LogpointInfo>;
  /** Have what these steps show read ahead of time, for going through them in either direction. */
  readAhead(steps: number[]): void;

  /* The app around it. */
  /** A step was gone to from here, so the playhead goes there too. */
  onStep(step: number, ms: number): void;
  onMarks(marks: TimelineMarks): void;
  status(text: string, options?: StatusOptions): void;
  /** Have the part of a very long recording around a time be what's here. Says whether that's what happened: it's called
   *  back with `ready` when it did. */
  openWindowAt?(ms: number): Promise<boolean>;
  /** Have the next or last part be what's here, and say which step of it to go to, or -1 if there isn't one. */
  stepAcross?(direction: 1 | -1): Promise<number>;
  /** A step that would pass where this recording hands the work to another. Says whether it went there instead. */
  crossWithStep?(how: NavigationKind, next: number): Promise<boolean>;
  /** What a step has to do with anything the host knows about, like the requests of a session. */
  describeStep?(info: StepInfo): StepLink[][] | null;
  /** Where the host keeps showing a logpoint's hits has more to show. */
  onLogpoints?(): void;
  onDevToolsPause?(step: number): void;
  onDevToolsEnded?(): void;

  /** A debugger of its own on this recording, if there is one. */
  devTools?: {
    open(): Promise<DevToolsReply>;
    playhead(position: { step: number; idle: boolean; seq: number }): void;
  };
}
