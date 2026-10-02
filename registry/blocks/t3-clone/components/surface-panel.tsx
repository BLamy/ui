import { SURFACES, SurfaceAgents, SurfaceAppPreview, SurfaceBrowser, SurfaceDiff, SurfaceFiles, SurfacePicker, SurfaceTerminal } from './workbench/surfaces';
import { WorkbenchPanel, WorkbenchPanelClose, WorkbenchPanelFullscreen, WorkbenchPanelHeader, WorkbenchPanelTitle } from './workbench/workbench-shell';
import { AGENTS, DIFF, FILES } from '../lib/data';
import type { Workspace } from '../lib/use-workspaces';
import { SessionBody } from './terminal-dock';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';

/** The right panel of a thread: a surface picker, or the surface open in that thread's workspace under a header with switch / fullscreen / close. */
export function SurfacePanel({ threadKey, workspace }: { threadKey: string; workspace: Workspace }) {
  const { surface, file } = workspace;
  const onSurface = workspace.setSurface;
  const meta = SURFACES.find((s) => s.k === surface);
  return (
    <WorkbenchPanel>
      <WorkbenchPanelHeader>
        <WorkbenchPanelTitle icon={meta?.icon}>{meta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
        {meta && (
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label="Switch surface"
            title="Switch surface"
            onPress={() => onSurface(null)}
          >
            <Icon name="chevron-down-wide" size={15} sw={1.7} />
          </Button>
        )}
        <WorkbenchPanelFullscreen />
        <WorkbenchPanelClose />
      </WorkbenchPanelHeader>

      {surface === 'browser' ? (
        <SurfaceBrowser url="http://localhost:3000">
          <SurfaceAppPreview name="app-builder" detail="serving on :3000 · pid 5229" />
        </SurfaceBrowser>
      ) : surface === 'terminal' ? (
        <SurfaceTerminal>
          <SessionBody threadKey={threadKey} workspace={workspace} />
        </SurfaceTerminal>
      ) : surface === 'files' ? (
        // Keyed by thread and file, so switching threads and "Go to file" both re-select in the tree.
        <SurfaceFiles key={`${threadKey}:${file}`} paths={FILES} selected={[file]} />
      ) : surface === 'diff' ? (
        <SurfaceDiff oldFile={DIFF.before} newFile={DIFF.after} />
      ) : surface === 'agents' ? (
        <SurfaceAgents agents={AGENTS} />
      ) : (
        <SurfacePicker onPick={onSurface} />
      )}
    </WorkbenchPanel>
  );
}
