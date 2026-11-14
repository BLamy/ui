import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import { TerminalAction, TerminalBody, TerminalHeader } from './workbench/terminal';
import { WorkbenchDock, WorkbenchDockClose } from './workbench/workbench-shell';
import type { Workspace } from '../lib/use-workspaces';

/** The active terminal of a thread's workspace. Keyed by thread and terminal, so each keeps its own prompt. */
export function SessionBody({ threadKey, workspace }: { threadKey: string; workspace: Workspace }) {
  const { active } = workspace;
  return <TerminalBody key={`${threadKey}:${active.id}`} lines={active.lines} onLinesChange={(lines) => workspace.setLines(active.id, lines)} />;
}

/** The bottom dock: the thread's terminals as tabs (a plain title while there is just one) over the active one. */
export function TerminalDock({ threadKey, workspace }: { threadKey: string; workspace: Workspace }) {
  const { terminals, terminal } = workspace;
  const tabbed = terminals.length > 1;
  const actions = (
    <>
      <TerminalAction icon="rectangle-split" label="Split terminal" />
      <TerminalAction icon="plus" label="New terminal" onClick={workspace.newTerminal} />
      {tabbed && <TerminalAction icon="xmark" label="Kill terminal" onClick={() => workspace.closeTerminal(terminal)} />}
      <WorkbenchDockClose />
    </>
  );
  if (!tabbed) {
    return (
      <WorkbenchDock>
        <TerminalHeader title={terminals[0].title}>{actions}</TerminalHeader>
        <SessionBody threadKey={threadKey} workspace={workspace} />
      </WorkbenchDock>
    );
  }
  return (
    <WorkbenchDock>
      {/* UI SDK Tabs: the header's tab list, and a panel per terminal (only the selected one mounts). */}
      <Tabs value={terminal} onValueChange={(id) => id && workspace.selectTerminal(id)} className="contents">
        <TerminalHeader
          title={
            <TabsList aria-label="Terminals" className="-my-0.5 flex gap-0.5">
              {terminals.map((t) => (
                <TabsTab
                  key={t.id}
                  value={t.id}
                  className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-0.5 [font-family:inherit] text-caption font-semibold text-tertiary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary hover:text-muted-foreground data-selected:bg-secondary data-selected:text-foreground"
                >
                  {t.title}
                </TabsTab>
              ))}
            </TabsList>
          }
        >
          {actions}
        </TerminalHeader>
        {terminals.map((t) => (
          <TabsPanel key={t.id} value={t.id} className="flex min-h-0 flex-1 flex-col outline-none">
            <SessionBody threadKey={threadKey} workspace={workspace} />
          </TabsPanel>
        ))}
      </Tabs>
    </WorkbenchDock>
  );
}
