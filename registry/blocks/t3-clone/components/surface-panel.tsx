import {
  Haptics,
  IconBtn,
  SURFACES,
  SurfaceAgents,
  SurfaceAppPreview,
  SurfaceBrowser,
  SurfaceDiff,
  SurfaceFiles,
  SurfacePicker,
  SurfaceTerminal,
  TerminalBody,
  WorkbenchPanel,
  WorkbenchPanelClose,
  WorkbenchPanelFullscreen,
  WorkbenchPanelHeader,
  WorkbenchPanelTitle,
  type SurfaceKind,
} from '@brett_lamy/ui';
import { AGENTS, DIFF, FILES } from '../lib/data';

/** The right panel: a surface picker, or the open surface under a header with switch / fullscreen / close. */
export function SurfacePanel({ surface, onSurface, file }: { surface: SurfaceKind | null; onSurface: (k: SurfaceKind | null) => void; /** file selected in the Files surface (Go to file) */ file?: string }) {
  const meta = SURFACES.find((s) => s.k === surface);
  return (
    <WorkbenchPanel>
      <WorkbenchPanelHeader>
        <WorkbenchPanelTitle icon={meta?.icon}>{meta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
        {meta && (
          <IconBtn
            name="chevron-down-wide"
            label="Switch surface"
            size={15}
            onPress={() => {
              Haptics.selection();
              onSurface(null);
            }}
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
          <TerminalBody />
        </SurfaceTerminal>
      ) : surface === 'files' ? (
        // Keyed by the file, so "Go to file" re-selects in the tree.
        <SurfaceFiles key={file} paths={FILES} selected={[file ?? 'cookbook/src/App.tsx']} />
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
