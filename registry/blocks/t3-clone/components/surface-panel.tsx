import { IconButton } from '@/components/ui/icon-button';
import { SURFACES, SurfaceAgents, SurfaceAppPreview, SurfaceBrowser, SurfaceDiff, SurfaceFiles, SurfacePicker, SurfaceTerminal } from './workbench/surfaces';
import { WorkbenchPanel, WorkbenchPanelClose, WorkbenchPanelFullscreen, WorkbenchPanelHeader, WorkbenchPanelTitle } from './workbench/workbench-shell';
import { AGENTS, DIFF, FILES } from '../lib/data';
import type { Workspace } from '../lib/use-workspaces';
import { SessionBody } from './terminal-dock';

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
          <IconButton
            name="chevron-down-wide"
            label="Switch surface"
            size={15}
            onPress={() => onSurface(null)}
          />
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
