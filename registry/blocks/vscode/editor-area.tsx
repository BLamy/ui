'use client';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { CodeEditor, type CodeEditorHandle } from '@/components/ui/code-editor';
import { Terminal, type TerminalHandle } from '@/components/ui/terminal';
import { OpenCode } from '@/components/ui/open-code';
import { TreeFileIcon } from '@/components/ui/tree';
import {
  Workspace, WorkspaceTabCloseButton, WorkspaceToolbar,
  type TabNode, type TabRenderProps, type TabsetNode, type WorkspaceImperativeHandle,
} from '@/components/ui/workspace';
import { Icon } from '@/lib/icon';
import { languageFromPath } from '@/lib/syntax';
import { cn } from '@/lib/utils';
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
        variant="ghost"
        className="h-full"
        value={text}
        onChange={(next) => store.edit(path, next)}
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
            <Button size="sm" variant="quiet" onPress={openCode.close}>Return to terminal</Button>
          </div>
          <OpenCode
            host={openCode.host}
            theme={appearance ?? 'dark'}
            className="min-h-0 flex-1 rounded-none border-0"
            style={{ height: '100%', minHeight: 0 }}
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
function TabsetToolbar({ store, tabset }: { store: VSCodeStore; tabset: TabsetNode<TabData> }) {
  const narrow = useSyncExternalStore(store.subscribe, () => store.narrow);
  const holdsTerminals = tabset.id === TERMINALS_TABSET || tabset.tabs.some((tab) => tab.data.kind === 'terminal');
  const canSplit = !narrow && tabset.tabs.length > 1;
  return (
    <WorkspaceToolbar className={narrow ? '[&>[aria-label$=pane]]:hidden' : undefined}>
      {holdsTerminals ? (
        <Button variant="quiet" size="icon-sm" aria-label="New terminal" title="New terminal" onPress={() => store.newTerminal()}>
          <Icon name="plus" size={14} />
        </Button>
      ) : null}
      {canSplit ? (
        <Button variant="quiet" size="icon-sm" aria-label="Split right" title="Split right" onPress={() => store.splitRight(tabset.id)}>
          <Icon name="rectangle-split" size={14} />
        </Button>
      ) : null}
    </WorkspaceToolbar>
  );
}

const WORKSPACE_CLASSES = {
  header: 'min-h-[35px] bg-muted',
  tab: 'gap-1.5 py-1.5 pe-1.5 ps-2.5 data-[tab-selected]:shadow-[inset_0_2px_0_var(--primary)]',
};

/** The editors and the terminals, in one Workspace: drag a tab to any edge to split there. */
export function EditorArea({ store }: { store: VSCodeStore }) {
  const narrow = useSyncExternalStore(store.subscribe, () => store.narrow);
  const renderTabContent = useCallback((tab: TabNode<TabData>) => (
    tab.data.kind === 'file' ? <FileEditor store={store} path={tab.data.path} /> : <TerminalPane store={store} id={tab.data.id} />
  ), [store]);
  const renderTab = useCallback((tab: TabNode<TabData>, props: TabRenderProps) => (
    <div {...props} className={cn(props.className)}>
      {tab.data.kind === 'file'
        ? <TreeFileIcon name={tab.title ?? ''} size={15} className="shrink-0 text-muted-foreground" />
        : <TerminalTabIcon store={store} id={tab.data.id} />}
      <span className="truncate">{tab.title ?? tab.id}</span>
      <WorkspaceTabCloseButton />
    </div>
  ), [store]);
  const renderToolbar = useCallback((tabset: TabsetNode<TabData>) => <TabsetToolbar store={store} tabset={tabset} />, [store]);
  const renderEmpty = useCallback((tabset: TabsetNode<TabData>) => (
    tabset.id === TERMINALS_TABSET ? (
      <div className="grid h-full place-items-center">
        <Button variant="quiet" onPress={() => store.newTerminal()}>New Terminal</Button>
      </div>
    ) : (
      <div className="grid h-full place-items-center text-footnote text-muted-foreground">
        {tabset.id === EDITORS_TABSET ? 'Open a file from the Explorer.' : 'Drag a tab here.'}
      </div>
    )
  ), [store]);
  const attach = useCallback((handle: WorkspaceImperativeHandle<TabData> | null) => store.attachWorkspace(handle), [store]);
  const model = useMemo(() => store.model, [store]);
  return (
    <Workspace<TabData>
      className="rounded-none border-0"
      classNames={WORKSPACE_CLASSES}
      defaultModel={model}
      renderTab={renderTab}
      renderTabContent={renderTabContent}
      renderTabsetToolbar={renderToolbar}
      renderEmptyTabset={renderEmpty}
      onModelChanged={store.onModelChanged}
      workspaceRef={attach}
      disableDrop={narrow}
    />
  );
}
