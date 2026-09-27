import { useState } from 'react'
import {
  SurfaceAgents,
  SurfaceAppPreview,
  SurfaceBrowser,
  SurfaceDiff,
  SurfaceFiles,
  SurfacePicker,
  SURFACES,
  SurfaceTerminal,
  TerminalBody,
  WorkbenchPanel,
  WorkbenchPanelClose,
  WorkbenchPanelHeader,
  WorkbenchPanelTitle,
  type SurfaceKind,
  WorkbenchTheme,
} from '@brett_lamy/ui'

function Surfaces() {
  // null shows the surface picker
  const [kind, setKind] = useState<SurfaceKind | null>(null)
  const meta = SURFACES.find((s) => s.k === kind)
  return (
    // a fixed-height, rounded window
    <div style={{ width: '100%', height: 380, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--wb-sep)' }}>
      <WorkbenchPanel>
        <WorkbenchPanelHeader>
          <WorkbenchPanelTitle icon={meta?.icon}>{meta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
          <WorkbenchPanelClose onPress={() => setKind(null)} />
        </WorkbenchPanelHeader>
        {kind === 'browser' ? (
          <SurfaceBrowser url="http://localhost:3000">
            <SurfaceAppPreview name="app-builder" detail="serving on :3000" />
          </SurfaceBrowser>
        ) : kind === 'terminal' ? (
          <SurfaceTerminal>
            <TerminalBody />
          </SurfaceTerminal>
        ) : kind === 'files' ? (
          <SurfaceFiles paths={['src/App.tsx', 'src/main.tsx', 'package.json']} />
        ) : kind === 'diff' ? (
          <SurfaceDiff oldFile={{ name: 'a.ts', contents: 'let a = 1\n' }} newFile={{ name: 'a.ts', contents: 'const a = 1\n' }} />
        ) : kind === 'agents' ? (
          <SurfaceAgents agents={[{ name: 'lint', status: 'passed', detail: 'no issues · 4s' }]} />
        ) : (
          <SurfacePicker onPick={setKind} />
        )}
      </WorkbenchPanel>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the app's light / dark appearance.
export default function SurfacesExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Surfaces />
    </WorkbenchTheme>
  )
}
