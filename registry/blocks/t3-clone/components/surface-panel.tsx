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
export function SurfacePanel({ surface, onSurface }: { surface: SurfaceKind | null; onSurface: (k: SurfaceKind | null) => void }) {
  const meta = SURFACES.find((s) => s.k === surface);
  return (
    <WorkbenchPanel>
      <WorkbenchPanelHeader>
        <WorkbenchPanelTitle icon={meta?.icon}>{meta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
        {meta && (
          <IconBtn
            name="chevD"
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
        <SurfaceFiles paths={FILES} selected={['cookbook/src/App.tsx']} />
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
