import { useState } from 'react'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'
import { SurfaceAgents, SurfaceAppPreview, SurfaceBrowser, SurfaceDiff, SurfaceFiles, SurfacePicker, SURFACES, SurfaceTerminal, type SurfaceKind } from '@/components/blocks/t3-clone/components/workbench/surfaces'
import { TerminalBody } from '@/components/blocks/t3-clone/components/workbench/terminal'
import { WorkbenchPanel, WorkbenchPanelClose, WorkbenchPanelHeader, WorkbenchPanelTitle } from '@/components/blocks/t3-clone/components/workbench/workbench-shell'

function Surfaces() {
  // null shows the surface picker
  const [kind, setKind] = useState<SurfaceKind | null>(null)
  const meta = SURFACES.find((s) => s.k === kind)
  return (
    // a fixed-height, rounded window
    <div
      style={{
        width: '100%',
        height: 380,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <WorkbenchPanel>
        <WorkbenchPanelHeader>
          <WorkbenchPanelTitle icon={meta?.icon}>
            {meta?.name ?? 'Surfaces'}
          </WorkbenchPanelTitle>
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
          <SurfaceFiles
            paths={['src/App.tsx', 'src/main.tsx', 'package.json']}
          />
        ) : kind === 'diff' ? (
          <SurfaceDiff
            oldFile={{ name: 'a.ts', contents: 'let a = 1\n' }}
            newFile={{ name: 'a.ts', contents: 'const a = 1\n' }}
          />
        ) : kind === 'agents' ? (
          <SurfaceAgents
            agents={[
              { name: 'lint', status: 'passed', detail: 'no issues · 4s' },
            ]}
          />
        ) : (
          <SurfacePicker onPick={setKind} />
        )}
      </WorkbenchPanel>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function SurfacesExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Surfaces />
    </WorkbenchTheme>
  )
}
