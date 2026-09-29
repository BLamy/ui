import { SurfaceFiles, WorkbenchTheme } from '@brett_lamy/ui'

const PATHS = [
  'cookbook/src/components/Credenza.tsx',
  'cookbook/src/components/SideDrawer.tsx',
  'cookbook/src/haptics.ts',
  'cookbook/src/App.tsx',
  'cookbook/package.json',
  'cookbook/vite.config.js',
]

function Files() {
  return (
    // a fixed-height, rounded window
    <div
      style={{
        width: '100%',
        height: 330,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: 330 }}>
        <SurfaceFiles paths={PATHS} selected={['cookbook/src/App.tsx']} />
      </div>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function FilesExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Files />
    </WorkbenchTheme>
  )
}
