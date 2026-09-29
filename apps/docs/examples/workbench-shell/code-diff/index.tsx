import { SurfaceDiff, WorkbenchTheme } from '@brett_lamy/ui'

function Change() {
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
      <div style={{ height: 330, overflow: 'auto' }}>
        <SurfaceDiff
          oldFile={{
            name: 'src/haptics.ts',
            contents: [
              'export async function bootHaptics() {',
              '  if (navigator.vibrate) return',
              "  await import('buzzkit')",
              '}',
            ].join('\n'),
          }}
          newFile={{
            name: 'src/haptics.ts',
            contents: [
              'export async function bootHaptics() {',
              '  if (isBlockingStub(navigator.vibrate)) ' +
                'delete navigator.vibrate',
              "  await import('buzzkit@3.0.3')",
              '}',
            ].join('\n'),
          }}
        />
      </div>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function ChangeExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Change />
    </WorkbenchTheme>
  )
}
