/* Everything the window shows that has to outlive the components showing it: the tree, the open tabs and their text, where
   the cursor is, what each terminal has printed. Panes come and go as the window narrows; this doesn't. All it knows of
   what's behind the window is the `VSCodeRuntime` it's given, whose calls all take time. */
import type { CodeEditorHandle } from '@/components/ui/code-editor';
import type { TerminalHandle } from '@/components/ui/terminal';
import type { OpenCodeHostBridge } from '@/lib/open-code-host';
import type { WorkspaceChangedMeta, WorkspaceImperativeHandle, WorkspaceModel, WorkspaceModelInput, WorkspaceNode, TabNode, TabsetNode } from '@/components/ui/workspace';
import { ancestors, basename, buildTree, dirname, isSearchable, isValidName, resolvePath } from './files';
import type { FileContent, RuntimeEntryKind, RuntimeFileEvent, RuntimeScriptList, RuntimeStatus, RuntimeTerminal, Unsubscribe, VSCodeRuntime } from './runtime';

export type TabData = { kind: 'file'; path: string } | { kind: 'terminal'; id: string };
export type VSCodeModel = WorkspaceModel<TabData>;

/** What the rail selects. `editor` and `terminal` are its own tabs in a narrow window, where one pane shows at a time. */
export type ViewId = 'explorer' | 'search' | 'run' | 'editor' | 'terminal';
export type SidebarView = Extract<ViewId, 'explorer' | 'search' | 'run'>;

export interface CursorPosition {
  /** From 1. */
  line: number;
  /** From 0. */
  column: number;
}

export interface TerminalRecord {
  id: string;
  title: string;
  /** The Run panel's script it runs, for a terminal of one. */
  script: string | null;
  /** `idle` until its pane has a size to open with. */
  state: 'idle' | 'opening' | 'open' | 'exited';
  exitCode: number | null;
  stream: RuntimeTerminal | null;
  /** The panel showing it. */
  handle: TerminalHandle | null;
  /** What it has printed, for a panel that mounts later. */
  output: Array<string | Uint8Array>;
  outputSize: number;
  /** What's been typed before it opened. */
  pendingInput: string[];
  /** Keys waiting for edits to be saved, so that what runs is what's on screen. */
  inputChain: Promise<void> | null;
  openCode: { host: OpenCodeHostBridge; close: () => void } | null;
  stop: Unsubscribe[];
}

export interface VSCodeStoreOptions {
  /** The file open to begin with, relative to the root. */
  initialFile?: string;
  /** The rail's tab to start on. A wide window has no editor or terminal tab, so there that's the Explorer. */
  initialView?: ViewId;
}

export const EDITORS_TABSET = 'editors';
export const TERMINALS_TABSET = 'terminals';

/** How long edits wait to be written; typing in a terminal writes them first. */
const SAVE_DELAY = 150;
/** Output kept for a panel that mounts later, in characters. */
const MAX_OUTPUT = 1_000_000;
/** Files read at once when Search needs them all. */
const SEARCH_READS_AT_ONCE = 16;

function tabsetsOf(node: WorkspaceNode<TabData>, out: TabsetNode<TabData>[] = []): TabsetNode<TabData>[] {
  if (node.type === 'tabset') out.push(node);
  else for (const child of node.children) tabsetsOf(child, out);
  return out;
}

export class VSCodeStore {
  readonly runtime: VSCodeRuntime;
  readonly root: string;
  private readonly initialFile: string | undefined;
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(runtime: VSCodeRuntime, options: VSCodeStoreOptions = {}) {
    this.runtime = runtime;
    this.root = runtime.files.root;
    this.initialFile = options.initialFile;
    if (options.initialView) this.view = options.initialView;
    if (options.initialView && options.initialView !== 'editor' && options.initialView !== 'terminal') this.lastSideView = options.initialView;
    this.status = runtime.status.get();
    const terminal = this.makeTerminal(null);
    this.activeTerminal = terminal.id;
    this.model = {
      version: 1,
      root: {
        type: 'split',
        orientation: 'vertical',
        children: [
          { type: 'tabset', id: EDITORS_TABSET, size: 68, keepWhenEmpty: true, tabs: [] },
          { type: 'tabset', id: TERMINALS_TABSET, size: 32, keepWhenEmpty: true, selectedId: terminal.id, tabs: [this.terminalTab(terminal)] },
        ],
      },
    };
  }

  /* ── Subscriptions ── */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Goes up on every change. */
  getVersion = () => this.version;

  private emit() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /* ── Lifetime ── */

  private mounted = false;
  private stopWatching: Unsubscribe[] = [];
  private unmountTimer: ReturnType<typeof setTimeout> | undefined;

  /** The window is up. Strict Mode's rehearsal unmount comes straight back, so going away waits a moment. */
  mount() {
    clearTimeout(this.unmountTimer);
    if (this.mounted) return;
    this.mounted = true;
    this.runtime.start?.();
    this.stopWatching = [
      this.runtime.files.watch((events) => this.applyEvents(events)),
      this.runtime.status.subscribe(() => {
        this.status = this.runtime.status.get();
        this.emit();
      }),
      this.runtime.scripts.onChange(() => { void this.loadScripts(); }),
    ];
    void this.loadScripts();
    void this.loadTree();
  }

  /** `then` runs once the window has really gone. */
  unmount(then?: () => void) {
    this.unmountTimer = setTimeout(() => {
      this.mounted = false;
      void this.flushSaves();
      for (const stop of this.stopWatching) stop();
      this.stopWatching = [];
      for (const terminal of [...this.terminals]) this.forgetTerminal(terminal);
      then?.();
    });
  }

  /* ── Status ── */

  status: RuntimeStatus;
  /** Something the window tried just now didn't work. */
  problem: string | null = null;
  private problemTimer: ReturnType<typeof setTimeout> | undefined;

  private report(what: string, error: unknown) {
    this.problem = `${what}: ${error instanceof Error ? error.message : String(error)}`;
    clearTimeout(this.problemTimer);
    this.problemTimer = setTimeout(() => {
      this.problem = null;
      this.emit();
    }, 6000);
    this.emit();
  }

  /* ── Files ── */

  readonly entries = new Map<string, RuntimeEntryKind>();
  private treeCache: { version: number; nodes: ReturnType<typeof buildTree> } | null = null;
  private structureVersion = 0;
  /** The tree has arrived once. */
  listed = false;

  private async loadTree() {
    try {
      const entries = await this.runtime.files.list();
      for (const { path, kind } of entries) this.setEntry(path, kind);
      this.listed = true;
      this.structureVersion += 1;
      this.openInitialFile();
      this.emit();
    } catch (error) {
      this.report('The files could not be listed', error);
    }
  }

  private openInitialFile() {
    const wanted = this.initialFile ? `${this.root}/${this.initialFile}` : `${this.root}/index.js`;
    const first = this.entries.get(wanted) === 'file'
      ? wanted
      : [...this.entries].filter(([path, kind]) => kind === 'file' && dirname(path) === this.root).map(([path]) => path).sort()[0];
    if (first) this.openFile(first, undefined, { focus: false });
  }

  private setEntry(path: string, kind: RuntimeEntryKind) {
    this.entries.set(path, kind);
    for (const dir of ancestors(path)) if (dir !== this.root && dir.startsWith(`${this.root}/`)) this.entries.set(dir, 'directory');
  }

  /** The Explorer's rows. The same array until a file or folder comes or goes. */
  tree = () => {
    if (this.treeCache?.version !== this.structureVersion) {
      const files: string[] = [];
      const dirs: string[] = [];
      for (const [path, kind] of this.entries) (kind === 'file' ? files : dirs).push(path);
      this.treeCache = { version: this.structureVersion, nodes: buildTree(this.root, files, dirs) };
    }
    return this.treeCache.nodes;
  };

  isFolder = (path: string) => this.entries.get(path) === 'directory';
  exists = (path: string) => this.entries.has(path) || path === this.root;

  /* What has been read. An open file stays here for as long as it's open, as does whatever Search has read. */
  private readonly contents = new Map<string, FileContent>();
  private readonly reads = new Map<string, number>();
  private readonly pendingSaves = new Set<string>();
  private readonly savesInFlight = new Map<string, number>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** The file's text; undefined until it's read, or if it isn't text. */
  text = (path: string): string | undefined => {
    const content = this.contents.get(path);
    return typeof content === 'string' ? content : undefined;
  };

  /** Read, and turned out not to be text. */
  isBinary = (path: string) => this.contents.get(path) instanceof Uint8Array;

  /** Reads a file. If a save is on its way what comes back is out of date, so it's ignored. */
  private async load(path: string) {
    const read = (this.reads.get(path) ?? 0) + 1;
    this.reads.set(path, read);
    try {
      const content = await this.runtime.files.read(path);
      if (this.reads.get(path) !== read || this.pendingSaves.has(path) || this.savesInFlight.has(path)) return;
      const was = this.contents.get(path);
      if (was === content || (was instanceof Uint8Array && content instanceof Uint8Array && was.length === content.length && was.every((b, i) => b === content[i]))) return;
      this.contents.set(path, content);
      this.emit();
    } catch (error) {
      if (this.entries.has(path)) this.report(`${basename(path)} could not be read`, error);
    }
  }

  /** The editor changed a file. Everything here sees it at once; the disk, a moment later. */
  edit(path: string, text: string) {
    if (this.contents.get(path) === text) return;
    this.contents.set(path, text);
    this.pendingSaves.add(path);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { void this.flushSaves(); }, SAVE_DELAY);
    this.emit();
  }

  private get saving() {
    return this.pendingSaves.size > 0 || this.savesInFlight.size > 0;
  }

  private savesDone: Promise<unknown> = Promise.resolve();

  /** Writes what's waiting. Resolves when all that's been sent is on disk. */
  flushSaves(): Promise<unknown> {
    clearTimeout(this.saveTimer);
    const writes = [...this.pendingSaves].map((path) => {
      this.pendingSaves.delete(path);
      this.savesInFlight.set(path, (this.savesInFlight.get(path) ?? 0) + 1);
      return this.runtime.files.write(path, this.contents.get(path) ?? '').catch((error: unknown) => {
        this.report(`${basename(path)} could not be saved`, error);
      }).finally(() => {
        const left = (this.savesInFlight.get(path) ?? 1) - 1;
        if (left) this.savesInFlight.set(path, left);
        else this.savesInFlight.delete(path);
      });
    });
    this.savesDone = Promise.all([this.savesDone, ...writes]);
    return this.savesDone;
  }

  /** Something changed on disk: files read so far catch up, and the tree shows what came and went. */
  private applyEvents(events: readonly RuntimeFileEvent[]) {
    let structure = false;
    for (const event of events) {
      if (event.type === 'change') {
        if (!this.entries.has(event.path)) {
          this.setEntry(event.path, event.kind);
          structure = true;
        }
        if (this.contents.has(event.path)) void this.load(event.path);
      } else if (event.type === 'delete') {
        if (this.removeLocally(event.path)) structure = true;
      } else if (this.entries.has(event.from) && !this.entries.has(event.to)) {
        this.moveLocally(event.from, event.to);
        structure = true;
      }
    }
    if (structure) {
      this.structureVersion += 1;
      this.emit();
    }
  }

  private removeLocally(path: string) {
    let found = false;
    for (const entry of [...this.entries.keys()]) {
      if (entry !== path && !entry.startsWith(`${path}/`)) continue;
      found = true;
      this.entries.delete(entry);
      this.contents.delete(entry);
      this.pendingSaves.delete(entry);
      this.closeFileTab(entry);
    }
    if (this.selectedPath && !this.entries.has(this.selectedPath)) this.selectedPath = null;
    return found;
  }

  /** Moves a file or folder here, and whatever is open from it. */
  private moveLocally(from: string, to: string) {
    const move = (path: string) => to + path.slice(from.length);
    for (const [entry, kind] of [...this.entries]) {
      if (entry !== from && !entry.startsWith(`${from}/`)) continue;
      const next = move(entry);
      this.entries.delete(entry);
      this.entries.set(next, kind);
      const content = this.contents.get(entry);
      if (content !== undefined) {
        this.contents.delete(entry);
        this.contents.set(next, content);
      }
      if (this.pendingSaves.delete(entry)) this.pendingSaves.add(next);
      this.followTab(entry, next);
      if (this.selectedPath === entry) this.selectedPath = next;
    }
    this.setEntry(to, this.entries.get(to) ?? 'file');
  }

  createFile(path: string, text = '') {
    this.setEntry(path, 'file');
    this.contents.set(path, text);
    this.structureVersion += 1;
    this.runtime.files.write(path, text).catch((error: unknown) => this.report(`${basename(path)} could not be created`, error));
    this.emit();
  }

  createFolder(path: string) {
    this.setEntry(path, 'directory');
    this.structureVersion += 1;
    this.runtime.files.mkdir(path).catch((error: unknown) => this.report(`${basename(path)} could not be created`, error));
    this.emit();
  }

  renamePath(from: string, to: string) {
    if (from === to || this.exists(to)) return;
    void this.flushSaves().then(() => this.runtime.files.rename(from, to)).catch((error: unknown) => this.report(`${basename(from)} could not be renamed`, error));
    this.moveLocally(from, to);
    this.structureVersion += 1;
    this.emit();
  }

  deletePath(path: string) {
    this.removeLocally(path);
    this.structureVersion += 1;
    void this.flushSaves().then(() => this.runtime.files.delete(path)).catch((error: unknown) => this.report(`${basename(path)} could not be deleted`, error));
    this.emit();
  }

  /* ── The Workspace ── */

  /** The layout, to mount a Workspace with. */
  model: WorkspaceModelInput<TabData> | VSCodeModel;
  private workspace: WorkspaceImperativeHandle<TabData> | null = null;
  private readonly fileTabs = new Map<string, string>();
  private nextFileTab = 1;

  /** The file showing in the last editor used, for the status bar and the Explorer. */
  activePath: string | null = null;
  /** The row selected in the Explorer: where a new file goes. */
  selectedPath: string | null = null;
  activeTerminal: string | null = null;

  attachWorkspace(handle: WorkspaceImperativeHandle<TabData> | null) {
    this.workspace = handle;
    if (handle && this.narrow) this.enterNarrow();
    if (handle && this.listed && !this.fileTabs.size) this.openInitialFile();
  }

  private fileTab(path: string): TabNode<TabData> {
    let id = this.fileTabs.get(path);
    if (!id) {
      id = `file-${this.nextFileTab}`;
      this.nextFileTab += 1;
      this.fileTabs.set(path, id);
    }
    return { id, title: basename(path), data: { kind: 'file', path } };
  }

  private terminalTab(terminal: TerminalRecord): TabNode<TabData> {
    return { id: terminal.id, title: terminal.title, data: { kind: 'terminal', id: terminal.id } };
  }

  private followTab(from: string, to: string) {
    const id = this.fileTabs.get(from);
    if (!id) return;
    this.fileTabs.delete(from);
    this.fileTabs.set(to, id);
    this.workspace?.updateTab(id, { title: basename(to), data: { kind: 'file', path: to } });
    const position = this.positions.get(from);
    if (position) this.positions.set(to, position);
    if (this.activePath === from) this.activePath = to;
  }

  private closeFileTab(path: string) {
    const id = this.fileTabs.get(path);
    if (id) this.workspace?.closeTab(id);
    this.fileTabs.delete(path);
    if (this.activePath === path) this.activePath = this.visibleFile();
  }

  /** Where a new file tab goes: beside the file in use, else the first place that holds files. */
  private editorTabset(): string {
    const model = this.workspace?.getModel();
    if (!model) return EDITORS_TABSET;
    const tabsets = tabsetsOf(model.root);
    const activeId = this.activePath ? this.fileTabs.get(this.activePath) : undefined;
    const holding = activeId ? tabsets.find((t) => t.tabs.some((tab) => tab.id === activeId)) : undefined;
    return holding?.id ?? (tabsets.some((t) => t.id === EDITORS_TABSET) ? EDITORS_TABSET : tabsets[0].id);
  }

  /** A file some tabset is showing, for when the one in use closes. */
  private visibleFile(): string | null {
    const model = this.workspace?.getModel();
    if (!model) return null;
    for (const tabset of tabsetsOf(model.root)) {
      const selected = tabset.tabs.find((tab) => tab.id === tabset.selectedId);
      if (selected?.data.kind === 'file' && this.entries.has(selected.data.path)) return selected.data.path;
    }
    return null;
  }

  /** Opens a file in a tab, or goes to its tab, optionally at a place in it. */
  openFile(path: string, reveal?: { line: number; column: number; length?: number }, options?: { focus?: boolean }) {
    if (this.entries.get(path) !== 'file') return;
    if (reveal) this.reveals.set(path, reveal);
    if (!this.contents.has(path)) void this.load(path);
    const existing = this.fileTabs.get(path);
    if (existing) this.workspace?.selectTab(existing);
    else this.workspace?.addTab(this.fileTab(path), { tabsetId: this.editorTabset() });
    this.activePath = path;
    this.selectedPath = path;
    if (this.narrow && options?.focus !== false) this.setView('editor');
    const editor = this.editors.get(path);
    if (editor && reveal) this.applyReveal(path, editor);
    if (options?.focus !== false) this.focusEditorSoon(path);
    this.emit();
  }

  /** Called for every change of layout. */
  onModelChanged = (model: VSCodeModel, meta: WorkspaceChangedMeta) => {
    this.model = model;
    const open = new Set<string>();
    for (const tabset of tabsetsOf(model.root)) for (const tab of tabset.tabs) open.add(tab.id);
    for (const [path, id] of [...this.fileTabs]) {
      if (open.has(id)) continue;
      this.fileTabs.delete(path);
      if (this.activePath === path) this.activePath = this.visibleFile();
      this.positions.delete(path);
    }
    for (const terminal of [...this.terminals]) {
      if (!open.has(terminal.id)) this.forgetTerminal(terminal);
    }
    if (meta.reason === 'select') {
      const tabsets = tabsetsOf(model.root);
      const active = tabsets.find((t) => t.id === this.workspace?.getActiveTabsetId());
      const selected = active?.tabs.find((tab) => tab.id === active.selectedId);
      if (selected?.data.kind === 'file') {
        this.activePath = selected.data.path;
        this.selectedPath = selected.data.path;
      } else if (selected?.data.kind === 'terminal') {
        this.activeTerminal = selected.data.id;
      }
    }
    this.emit();
  };

  /** Moves the tab on show into a new split on the right of its tabset. */
  splitRight(tabsetId: string) {
    const model = this.workspace?.getModel();
    if (!model) return;
    const tabset = tabsetsOf(model.root).find((t) => t.id === tabsetId);
    const selected = tabset?.selectedId;
    if (tabset && selected && tabset.tabs.length > 1) this.workspace?.moveTab(selected, { tabsetId, region: 'right' });
  }

  /* ── Editors ── */

  private readonly editors = new Map<string, CodeEditorHandle>();
  private readonly positions = new Map<string, CursorPosition>();
  private readonly reveals = new Map<string, { line: number; column: number; length?: number }>();

  /** An editor's handle, while it's mounted. Goes to anywhere it was sent before it was there. */
  registerEditor(path: string, handle: CodeEditorHandle | null) {
    if (!handle) {
      this.editors.delete(path);
      return;
    }
    this.editors.set(path, handle);
    if (this.reveals.has(path)) this.applyReveal(path, handle);
  }

  private applyReveal(path: string, handle: CodeEditorHandle) {
    const reveal = this.reveals.get(path);
    if (!reveal) return;
    this.reveals.delete(path);
    handle.setSelection({ anchor: { line: reveal.line, column: reveal.column }, focus: { line: reveal.line, column: reveal.column + (reveal.length ?? 0) } });
    handle.scrollToLine(reveal.line);
  }

  private focusEditorSoon(path: string) {
    // The tab has to be selected and painted before its editor can take focus.
    requestAnimationFrame(() => this.editors.get(path)?.focus());
  }

  cursor = (path: string | null) => (path ? this.positions.get(path) ?? null : null);

  setCursor(path: string, position: CursorPosition) {
    const was = this.positions.get(path);
    if (was?.line === position.line && was.column === position.column) return;
    this.positions.set(path, position);
    this.emit();
  }

  setActiveEditor(path: string) {
    if (this.activePath === path && this.selectedPath === path) return;
    this.activePath = path;
    this.selectedPath = path;
    this.emit();
  }

  /* ── Terminals ──
     Each panel sees only a raw stream. A terminal opens when its panel has a size to give it. */

  readonly terminals: TerminalRecord[] = [];
  private nextTerminal = 1;

  terminal = (id: string) => this.terminals.find((t) => t.id === id) ?? null;

  private makeTerminal(script: string | null): TerminalRecord {
    const id = `terminal-${this.nextTerminal}`;
    const title = script ? `Run: ${script}` : `Terminal ${this.nextTerminal}`;
    this.nextTerminal += 1;
    const record: TerminalRecord = {
      id, title, script, state: 'idle', exitCode: null, stream: null, handle: null, output: [], outputSize: 0, pendingInput: [], inputChain: null, openCode: null, stop: [],
    };
    this.terminals.push(record);
    return record;
  }

  /** The panel mounted: it shows what's been printed so far, and what's printed from now on. */
  attachTerminal(id: string, handle: TerminalHandle) {
    const record = this.terminal(id);
    if (!record) return;
    record.handle = handle;
    for (const chunk of record.output) handle.write(chunk);
  }

  detachTerminal(id: string, handle: TerminalHandle) {
    const record = this.terminal(id);
    if (record?.handle === handle) record.handle = null;
  }

  /** The panel has a size. The first time, that opens the terminal; after that, it's a resize. */
  sizeTerminal(id: string, cols: number, rows: number) {
    const record = this.terminal(id);
    if (!record || cols < 1 || rows < 1) return;
    if (record.state === 'idle') this.openStream(record, cols, rows);
    else record.stream?.resize(cols, rows);
  }

  private openStream(record: TerminalRecord, cols: number, rows: number) {
    record.state = 'opening';
    this.emit();
    void this.flushSaves()
      .then(() => (record.script ? this.runtime.scripts.run(record.script, { cols, rows }) : this.runtime.terminals.open({
        cols, rows, onOpenCode: (host, signal) => this.launchOpenCode(record, host, signal),
      })))
      .then(
        (stream) => {
          if (!this.terminals.includes(record)) {
            stream.kill();
            return;
          }
          record.stream = stream;
          record.state = 'open';
          record.stop = [
            stream.onOutput((data) => this.terminalOutput(record, data)),
            stream.onExit((code) => this.terminalExited(record, code)),
          ];
          for (const data of record.pendingInput.splice(0)) stream.write(data);
          // The panel may have changed size while it opened.
          const { handle } = record;
          if (handle && handle.cols > 0 && (handle.cols !== cols || handle.rows !== rows)) stream.resize(handle.cols, handle.rows);
          this.emit();
        },
        (error: unknown) => {
          record.state = 'exited';
          this.terminalOutput(record, `\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m\r\n`);
          this.emit();
        },
      );
  }

  private terminalOutput(record: TerminalRecord, data: string | Uint8Array) {
    record.output.push(data);
    record.outputSize += data.length;
    while (record.outputSize > MAX_OUTPUT && record.output.length > 1) record.outputSize -= (record.output.shift() as string | Uint8Array).length;
    record.handle?.write(data);
  }

  private launchOpenCode(record: TerminalRecord, host: OpenCodeHostBridge, signal: AbortSignal): Promise<void> {
    if (signal.aborted || !this.terminals.includes(record)) return Promise.resolve();
    if (this.terminals.some((terminal) => terminal.openCode)) {
      return Promise.reject(new Error('OpenCode is already running in another terminal. Stop it there first.'));
    }
    return new Promise((resolve) => {
      const model = this.workspace?.getModel();
      const pane = model && !model.maximizedTabsetId ? tabsetsOf(model.root).find((tabset) => tabset.tabs.some((tab) => tab.id === record.id)) : undefined;
      const close = () => {
        if (!record.openCode) return;
        record.openCode = null;
        signal.removeEventListener('abort', close);
        if (pane && this.workspace?.getModel().maximizedTabsetId === pane.id) this.workspace.restoreTabset();
        this.emit();
        resolve();
        this.focusTerminalSoon(record.id);
      };
      record.openCode = { host, close };
      if (pane) this.workspace?.maximizeTabset(pane.id);
      signal.addEventListener('abort', close, { once: true });
      this.emit();
    });
  }

  private terminalExited(record: TerminalRecord, code: number | null) {
    record.state = 'exited';
    record.exitCode = code;
    record.stream = null;
    for (const stop of record.stop) stop();
    record.stop = [];
    // A shell that ended well just goes. Otherwise its tab stays, so that what happened can be read.
    if (!record.script && !code) {
      this.closeTerminal(record.id);
      return;
    }
    const failed = !!code;
    // Nothing is listening any more, so no cursor either. A run in the same tab shows it again.
    this.terminalOutput(record, `\r\n\x1b[${failed ? 31 : 2}m[exited${code === null ? '' : ` with code ${code}`}]\x1b[0m\r\n\x1b[?25l`);
    this.emit();
  }

  /** What the panel's keyboard sent. Anything typed in a terminal could run something, so edits are saved first. */
  terminalInput(id: string, data: string) {
    const record = this.terminal(id);
    if (!record || record.state === 'exited') return;
    if (!record.stream) {
      record.pendingInput.push(data);
      return;
    }
    if (!this.saving && !record.inputChain) {
      record.stream.write(data);
      return;
    }
    const chain: Promise<void> = (record.inputChain ?? this.flushSaves().then(() => {})).then(() => {
      record.stream?.write(data);
      if (record.inputChain === chain) record.inputChain = null;
    });
    record.inputChain = chain;
  }

  newTerminal() {
    const terminal = this.makeTerminal(null);
    this.addTerminalTab(terminal);
    this.focusTerminalSoon(terminal.id);
    return terminal;
  }

  private addTerminalTab(terminal: TerminalRecord) {
    const model = this.workspace?.getModel();
    const tabsets = model ? tabsetsOf(model.root) : [];
    const beside = tabsets.find((t) => t.tabs.some((tab) => tab.data.kind === 'terminal')) ?? tabsets.find((t) => t.id === TERMINALS_TABSET) ?? tabsets[0];
    this.workspace?.addTab(this.terminalTab(terminal), { tabsetId: beside?.id });
    this.activeTerminal = terminal.id;
    if (this.narrow) this.setView('terminal');
    this.emit();
  }

  closeTerminal(id: string) {
    const terminal = this.terminal(id);
    if (!terminal) return;
    this.workspace?.closeTab(id);
    // Closing the tab tells `onModelChanged`, which forgets it; without a Workspace, do it here.
    this.forgetTerminal(terminal);
    this.emit();
  }

  private forgetTerminal(terminal: TerminalRecord) {
    const at = this.terminals.indexOf(terminal);
    if (at < 0) return;
    this.terminals.splice(at, 1);
    for (const stop of terminal.stop) stop();
    terminal.stop = [];
    terminal.stream?.kill();
    terminal.openCode?.close();
    terminal.stream = null;
    if (this.activeTerminal === terminal.id) this.activeTerminal = this.terminals.at(-1)?.id ?? null;
  }

  setActiveTerminal(id: string) {
    if (this.activeTerminal === id) return;
    this.activeTerminal = id;
    this.emit();
  }

  private focusTerminalSoon(id: string) {
    requestAnimationFrame(() => this.terminal(id)?.handle?.focus());
  }

  /* ── The Run panel ── */

  scripts: RuntimeScriptList = { scripts: [] };

  private async loadScripts() {
    try {
      this.scripts = await this.runtime.scripts.list();
    } catch (error) {
      this.scripts = { scripts: [], note: error instanceof Error ? error.message : String(error) };
    }
    this.emit();
  }

  /** The terminal of a script's last run. */
  scriptTerminal = (name: string) => this.terminals.find((t) => t.script === name) ?? null;

  /** Runs a script in a terminal of its own, again in the same tab if it's run before. */
  runScript(name: string) {
    let terminal = this.scriptTerminal(name);
    if (terminal && (terminal.state === 'open' || terminal.state === 'opening')) {
      this.showTerminal(terminal);
      return;
    }
    if (terminal) {
      terminal.output = [];
      terminal.outputSize = 0;
      terminal.state = 'idle';
      terminal.exitCode = null;
      terminal.handle?.clear();
      terminal.handle?.write('\x1b[?25h');
      this.showTerminal(terminal);
      if (terminal.handle && terminal.handle.cols > 0) this.sizeTerminal(terminal.id, terminal.handle.cols, terminal.handle.rows);
      return;
    }
    terminal = this.makeTerminal(name);
    this.addTerminalTab(terminal);
    this.showTerminal(terminal);
  }

  stopScript(name: string) {
    this.scriptTerminal(name)?.stream?.kill();
  }

  private showTerminal(terminal: TerminalRecord) {
    this.activeTerminal = terminal.id;
    this.workspace?.selectTab(terminal.id);
    if (this.narrow) this.setView('terminal');
    this.focusTerminalSoon(terminal.id);
    this.emit();
  }

  /* ── The rail, the sidebar and the narrow layout ── */

  view: ViewId = 'explorer';
  /** The side panel last on show, kept in the hidden sidebar while the view is the editor or the terminal. */
  lastSideView: SidebarView = 'explorer';
  sidebarOpen = true;
  narrow = false;
  /** The layout from before the window got narrow, to go back to. */
  private wideModel: VSCodeModel | null = null;

  setView(view: ViewId) {
    if (this.view !== view) {
      this.view = view;
      if (view !== 'editor' && view !== 'terminal') this.lastSideView = view;
      if (view === 'editor') this.workspace?.maximizeTabset(this.editorTabset());
      if (view === 'terminal') this.workspace?.maximizeTabset(this.terminalTabset());
      this.emit();
    }
    if (view === 'terminal' && this.activeTerminal) this.focusTerminalSoon(this.activeTerminal);
  }

  /** The rail's tab for the view on show, pressed: closes the sidebar, as an editor's does. */
  toggleSidebar(open = !this.sidebarOpen) {
    if (this.sidebarOpen === open) return;
    this.sidebarOpen = open;
    this.emit();
  }

  private terminalTabset() {
    const model = this.workspace?.getModel();
    const tabsets = model ? tabsetsOf(model.root) : [];
    return (tabsets.find((t) => t.tabs.some((tab) => tab.id === this.activeTerminal)) ?? tabsets.find((t) => t.id === TERMINALS_TABSET))?.id ?? TERMINALS_TABSET;
  }

  setNarrow(narrow: boolean) {
    if (this.narrow === narrow) return;
    this.narrow = narrow;
    if (narrow) this.enterNarrow();
    else this.leaveNarrow();
    this.emit();
  }

  /** One pane at a time: every file in one tabset and every terminal in the other, with one of them filling the window. */
  private enterNarrow() {
    const workspace = this.workspace;
    if (!workspace) return;
    const model = workspace.getModel();
    this.wideModel = model;
    for (const tabset of tabsetsOf(model.root)) {
      for (const tab of tabset.tabs) {
        const home = tab.data.kind === 'file' ? EDITORS_TABSET : TERMINALS_TABSET;
        if (tabset.id !== home) workspace.moveTab(tab.id, { tabsetId: home, index: 0 });
      }
    }
    if (this.activePath) {
      const id = this.fileTabs.get(this.activePath);
      if (id) workspace.selectTab(id);
    }
    if (this.activeTerminal) workspace.selectTab(this.activeTerminal);
    workspace.maximizeTabset(this.view === 'terminal' ? TERMINALS_TABSET : EDITORS_TABSET);
  }

  private leaveNarrow() {
    const workspace = this.workspace;
    if (!workspace) return;
    workspace.restoreTabset();
    if (this.wideModel) workspace.setModel(this.restoredModel(this.wideModel, workspace.getModel()));
    this.wideModel = null;
    if (this.view === 'editor' || this.view === 'terminal') this.view = 'explorer';
    this.sidebarOpen = true;
  }

  /** The wide layout again, with the tabs that exist now: those closed since go, those opened since join their tabset. */
  private restoredModel(wide: VSCodeModel, now: VSCodeModel): VSCodeModel {
    const current = new Map(tabsetsOf(now.root).flatMap((tabset) => tabset.tabs.map((tab) => [tab.id, tab] as const)));
    const placed = new Set<string>();
    const selectedNow = new Map(tabsetsOf(now.root).map((tabset) => [tabset.id, tabset.selectedId]));
    const rebuild = (node: WorkspaceNode<TabData>): WorkspaceNode<TabData> => {
      if (node.type === 'split') return { ...node, children: node.children.map(rebuild) };
      const tabs = node.tabs.flatMap((tab) => {
        const kept = current.get(tab.id);
        if (kept) placed.add(tab.id);
        return kept ? [kept] : [];
      });
      return { ...node, tabs, selectedId: tabs.some((tab) => tab.id === node.selectedId) ? node.selectedId : tabs[0]?.id };
    };
    const root = rebuild(wide.root);
    for (const tabset of tabsetsOf(root)) {
      if (tabset.id !== EDITORS_TABSET && tabset.id !== TERMINALS_TABSET) continue;
      const late = [...current.values()].filter((tab) => !placed.has(tab.id) && (tab.data.kind === 'file') === (tabset.id === EDITORS_TABSET));
      for (const tab of late) {
        tabset.tabs.push(tab);
        placed.add(tab.id);
      }
      const selected = selectedNow.get(tabset.id);
      if (selected && tabset.tabs.some((tab) => tab.id === selected)) tabset.selectedId = selected;
      else tabset.selectedId ??= tabset.tabs[0]?.id;
    }
    return { ...wide, root, maximizedTabsetId: undefined };
  }

  /* ── Search: what's typed stays when the panel goes ── */

  searchQuery = '';
  searchMatchCase = false;
  searchRegex = false;
  private searchLoading = false;

  setSearch(changes: { query?: string; matchCase?: boolean; regex?: boolean }) {
    if (changes.query !== undefined) this.searchQuery = changes.query;
    if (changes.matchCase !== undefined) this.searchMatchCase = changes.matchCase;
    if (changes.regex !== undefined) this.searchRegex = changes.regex;
    this.emit();
  }

  /** What Search looks through: everything worth searching that has been read. */
  searchable(): Array<readonly [string, FileContent]> {
    return [...this.contents].filter(([path]) => isSearchable(path) && this.entries.get(path) === 'file');
  }

  /** Reads whatever Search still needs, a few at a time, showing what it finds as it goes. */
  async loadForSearch() {
    if (this.searchLoading) return;
    const missing = [...this.entries].flatMap(([path, kind]) => (kind === 'file' && isSearchable(path) && !this.contents.has(path) ? [path] : []));
    if (!missing.length) return;
    this.searchLoading = true;
    try {
      for (let i = 0; i < missing.length; i += SEARCH_READS_AT_ONCE) await Promise.all(missing.slice(i, i + SEARCH_READS_AT_ONCE).map((path) => this.load(path)));
    } finally {
      this.searchLoading = false;
    }
  }

  /* ── The Explorer ── */

  /** The row being renamed in place, and whether it was just made (so that cancelling takes it away again). */
  renaming: { path: string; isNew: boolean } | null = null;
  /** The row whose delete is being confirmed. */
  deleting: string | null = null;
  /** A new folder being named, in this folder. It needs its name before there's a row for it. */
  naming: { folder: string } | null = null;

  setSelected(path: string | null) {
    if (this.selectedPath === path) return;
    this.selectedPath = path;
    this.emit();
  }

  /** The folder to keep open, so that the selected row and a new row are in view. */
  foldersToShow(): string[] {
    const path = this.renaming?.path ?? this.selectedPath;
    if (!path) return [];
    const parent = dirname(path);
    return parent === this.root || !parent.startsWith(`${this.root}/`) ? [] : [parent];
  }

  /** The folder a new file goes in: the row selected, or the folder of the file selected. */
  targetFolder() {
    const path = this.selectedPath;
    if (!path) return this.root;
    return this.isFolder(path) ? path : dirname(path);
  }

  private untitled(folder: string, stem: string, extension = '') {
    for (let n = 0; ; n += 1) {
      const path = `${folder}/${stem}${n ? `-${n}` : ''}${extension}`;
      if (!this.exists(path)) return path;
    }
  }

  beginNewFile(folder = this.targetFolder()) {
    const path = this.untitled(folder, 'untitled', '.js');
    this.createFile(path);
    this.selectedPath = path;
    this.emit();
    // Its row has to be there first.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.renaming = { path, isNew: true };
      this.emit();
    }));
  }

  beginNewFolder(folder = this.targetFolder()) {
    this.naming = { folder };
    this.emit();
  }

  beginRename(path: string) {
    this.renaming = { path, isNew: false };
    this.emit();
  }

  /** The new folder dialog's name: what's wrong with it, or null if it's done. */
  commitFolderName(name: string): string | null {
    const naming = this.naming;
    if (!naming) return null;
    if (!isValidName(name)) return 'A name can\'t be empty or contain a slash.';
    const to = resolvePath(naming.folder, name);
    if (this.exists(to)) return `There's already something called ${name} here.`;
    this.createFolder(to);
    this.selectedPath = to;
    this.endFolderName();
    return null;
  }

  endFolderName() {
    this.naming = null;
    this.emit();
  }

  /** The row's new name, from the field. */
  commitRename(path: string, name: string) {
    const isNew = this.renaming?.path === path && this.renaming.isNew;
    const to = resolvePath(dirname(path), name);
    if (dirname(to) !== dirname(path) || this.exists(to)) return;
    this.renamePath(path, to);
    this.renaming = null;
    if (isNew && this.entries.get(to) === 'file') this.openFile(to);
    this.emit();
  }

  /** The field went away. Escape on a new row takes the row away too; otherwise it keeps the name it was given. */
  endRename(cancelled: boolean) {
    const was = this.renaming;
    if (!was) return;
    this.renaming = null;
    if (was.isNew && cancelled) this.deletePath(was.path);
    else if (was.isNew && this.entries.get(was.path) === 'file') this.openFile(was.path);
    this.emit();
  }

  confirmDelete(path: string | null) {
    this.deleting = path;
    this.emit();
  }
}
