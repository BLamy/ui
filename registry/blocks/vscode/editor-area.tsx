'use client';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { CodeEditor, type CodeEditorHandle } from '@/components/ui/code-editor';
import { Terminal, type TerminalHandle } from '@/components/ui/terminal';
import { OpenCode } from '@/components/ui/open-code';
import { FileBadgeIcon } from '@/lib/file-icons';
import {
  Workspace, WorkspaceTab, WorkspaceTabClose, WorkspaceTabTrigger, WorkspaceToolbar,
  type WorkspaceTabNode, type WorkspaceTabsetNode,
} from '@/components/ui/workspace';
import { Icon } from '@/lib/icon';
import { languageFromPath } from '@/lib/syntax';
import { useAppearance } from '@/lib/theme';
import { EDITORS_TABSET, TERMINALS_TABSET, type TabData, type VSCodeStore } from './store';

function FileEditor({ store, path }: { store: VSCodeStore; path: string }) {
  const text = useSyncExternalStore(store.subscribe, () => store.text(path));
  const binary = useSyncExternalStore(store.subscribe, () => store.isBinary(path));
  const editor = useRef<CodeEditorHandle>(null);
  const ready = text !== undefined;
  useEffect(() => {
    if (!ready) return undefined;
    store.registerEditor(path, editor.current);
    return () => store.registerEditor(path, null);
  }, [store, path, ready]);
  if (binary) return <div className="grid h-full place-items-center text-footnote text-muted-foreground">This file isn't text, so it can't be shown here.</div>;
  if (!ready) return <div className="h-full" data-slot="vscode-editor" data-path={path} />;
  return (
    <div className="h-full min-h-0" data-slot="vscode-editor" data-path={path} onFocusCapture={() => store.setActiveEditor(path)}>
      <CodeEditor
        ref={editor}
        variant="plain"
        className="h-full"
        value={text}
        onValueChange={(next) => store.edit(path, next)}
        language={languageFromPath(path)}
        onSelectionChange={(selection) => { if (selection) store.setCursor(path, selection.focus); }}
      />
    </div>
  );
}

/* A panel sees a raw stream and nothing else: keys go to it, what comes back is written here. */
function TerminalPane({ store, id }: { store: VSCodeStore; id: string }) {
  const term = useRef<TerminalHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const openCode = useSyncExternalStore(store.subscribe, () => store.terminal(id)?.openCode ?? null);
  const appearance = useAppearance();
  useEffect(() => {
    // A hidden tab has no size to open with, so its terminal waits until it's first on show.
    const element = box.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => {
      const handle = term.current;
      if (!handle?.instance || element.clientWidth < 1 || element.clientHeight < 1) return;
      handle.fit();
      store.sizeTerminal(id, handle.cols, handle.rows);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [store, id]);
  return (
    <div ref={box} className="relative size-full min-h-0" data-slot="vscode-terminal">
      {openCode ? (
        <div className="absolute inset-0 z-10 flex min-h-0 flex-col bg-background" data-slot="vscode-opencode">
          <div className="flex shrink-0 justify-end border-b border-border px-2">
            <Button size="sm" variant="quiet" onClick={openCode.close}>Return to terminal</Button>
          </div>
          <OpenCode
            host={openCode.host}
            appearance={appearance}
            variant="plain"
            className="h-full min-h-0 flex-1"
            onStateChange={(state) => { if (state === 'stopped') openCode.close(); }}
          />
        </div>
      ) : null}
      <div className="size-full" inert={!!openCode || undefined} style={openCode ? { visibility: 'hidden' } : undefined}>
        <Terminal
          ref={term}
          size="sm"
          className="[--term-bg:var(--card)]"
          aria-label={store.terminal(id)?.title}
          onData={(data) => store.terminalInput(id, data)}
          onFocusCapture={() => store.setActiveTerminal(id)}
          onReady={() => {
            const handle = term.current;
            if (!handle) return;
            store.attachTerminal(id, handle);
            if (box.current && box.current.clientWidth > 0 && box.current.clientHeight > 0) store.sizeTerminal(id, handle.cols, handle.rows);
          }}
          onResize={(cols, rows) => { if (box.current && box.current.clientWidth > 0) store.sizeTerminal(id, cols, rows); }}
        />
      </div>
    </div>
  );
}

function TerminalTabIcon({ store, id }: { store: VSCodeStore; id: string }) {
  // Only what the store can tell from a raw stream: a script's terminal is running until it exits.
  const running = useSyncExternalStore(store.subscribe, () => {
    const record = store.terminal(id);
    return !!record?.script && (record.state === 'open' || record.state === 'opening');
  });
  return (
    <span className="relative flex shrink-0">
      <Icon name="terminal" size={14} className="text-muted-foreground" />
      {running ? <span aria-label="Running" className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-primary" /> : null}
    </span>
  );
}

/** After the tabs: a new terminal or a split, where each makes sense, and maximize in a wide window. */
function TabsetToolbar({ store, tabset }: { store: VSCodeStore; tabset: WorkspaceTabsetNode<TabData> }) {
  const narrow = useSyncExternalStore(store.subscribe, () => store.narrow);
  const holdsTerminals = tabset.id === TERMINALS_TABSET || tabset.tabs.some((tab) => tab.data.kind === 'terminal');
  const canSplit = !narrow && tabset.tabs.length > 1;
  return (
    <WorkspaceToolbar className={narrow ? '[&>[aria-label$=pane]]:hidden' : undefined}>
      {holdsTerminals ? (
        <Button variant="quiet" size="icon-sm" aria-label="New terminal" title="New terminal" onClick={() => store.newTerminal()}>
          <Icon name="plus" size={14} />
        </Button>
      ) : null}
      {canSplit ? (
        <Button variant="quiet" size="icon-sm" aria-label="Split right" title="Split right" onClick={() => store.splitRight(tabset.id)}>
          <Icon name="rectangle-split" size={14} />
        </Button>
      ) : null}
    </WorkspaceToolbar>
  );
}

const WORKSPACE_CLASSES = {
  header: 'min-h-[35px] bg-muted',
  tab: 'gap-1.5 py-1.5 pe-1.5 ps-2.5 data-selected:shadow-[inset_0_2px_0_var(--primary)]',
};

/** The editors and the terminals, in one Workspace: drag a tab to any edge to split there. */
export function EditorArea({ store }: { store: VSCodeStore }) {
  const narrow = useSyncExternalStore(store.subscribe, () => store.narrow);
  const renderTabContent = useCallback((tab: WorkspaceTabNode<TabData>) => (
    tab.data.kind === 'file' ? <FileEditor store={store} path={tab.data.path} /> : <TerminalPane store={store} id={tab.data.id} />
  ), [store]);
  const renderTab = useCallback((tab: WorkspaceTabNode<TabData>) => (
    <WorkspaceTab value={tab.id}>
      <WorkspaceTabTrigger>
        {tab.data.kind === 'file'
          ? <FileBadgeIcon name={tab.title ?? ''} size={15} className="shrink-0 text-muted-foreground" />
          : <TerminalTabIcon store={store} id={tab.data.id} />}
        <span className="truncate">{tab.title ?? tab.id}</span>
      </WorkspaceTabTrigger>
      <WorkspaceTabClose />
    </WorkspaceTab>
  ), [store]);
  const renderToolbar = useCallback((tabset: WorkspaceTabsetNode<TabData>) => <TabsetToolbar store={store} tabset={tabset} />, [store]);
  const renderEmpty = useCallback((tabset: WorkspaceTabsetNode<TabData>) => (
    tabset.id === TERMINALS_TABSET ? (
      <div className="grid h-full place-items-center">
        <Button variant="quiet" onClick={() => store.newTerminal()}>New Terminal</Button>
      </div>
    ) : (
      <div className="grid h-full place-items-center text-footnote text-muted-foreground">
        {tabset.id === EDITORS_TABSET ? 'Open a file from the Explorer.' : 'Drag a tab here.'}
      </div>
    )
  ), [store]);
  // The layout it mounts with; after that the Workspace owns it and the store follows `onLayoutCommit`.
  const layout = useMemo(() => store.layout, [store]);
  // The store drives the Workspace through its controller, which works once the Workspace is mounted.
  useEffect(() => {
    store.workspaceMounted(true);
    return () => store.workspaceMounted(false);
  }, [store]);
  return (
    <Workspace<TabData>
      aria-label="Editors and terminals"
      // The rail switches between the editors and the terminals on a phone, so the panes stay docked.
      presentation="docked"
      classNames={WORKSPACE_CLASSES}
      controller={store.workspace}
      defaultLayout={layout}
      renderTab={renderTab}
      renderTabContent={renderTabContent}
      renderTabsetToolbar={renderToolbar}
      renderEmptyTabset={renderEmpty}
      onLayoutCommit={store.onLayoutCommit}
      // One pane at a time in a narrow window, so nothing to split or move a tab to.
      accepts={narrow ? () => false : undefined}
    />
  );
}
