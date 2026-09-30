import { Tab, TabList, Tabs } from 'react-aria-components';
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
  return (
    <WorkbenchDock>
      <TerminalHeader
        title={
          terminals.length > 1 ? (
            <Tabs selectedKey={terminal} onSelectionChange={(k) => workspace.selectTerminal(String(k))}>
              <TabList aria-label="Terminals" className="-my-0.5 flex gap-0.5">
                {terminals.map((t) => (
                  <Tab
                    key={t.id}
                    id={t.id}
                    className="cursor-pointer rounded-md px-2 py-0.5 text-[12px] font-semibold text-tertiary-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-muted-foreground data-selected:bg-secondary data-selected:text-foreground"
                  >
                    {t.title}
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          ) : (
            terminals[0].title
          )
        }
      >
        <TerminalAction icon="rectangle-split" label="Split terminal" />
        <TerminalAction icon="plus" label="New terminal" onPress={workspace.newTerminal} />
        {terminals.length > 1 && <TerminalAction icon="xmark" label="Kill terminal" onPress={() => workspace.closeTerminal(terminal)} />}
        <WorkbenchDockClose />
      </TerminalHeader>
      <SessionBody threadKey={threadKey} workspace={workspace} />
    </WorkbenchDock>
  );
}
