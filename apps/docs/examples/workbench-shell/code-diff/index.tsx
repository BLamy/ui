import { SurfaceDiff, WorkbenchTheme } from '@brett_lamy/ui'

function Change() {
  return (
    // a fixed-height, rounded window
    <div style={{ width: '100%', height: 330, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--wb-sep)' }}>
      <div style={{ height: 330, overflow: 'auto' }}>
        <SurfaceDiff
          oldFile={{
            name: 'src/haptics.ts',
            contents: "export async function bootHaptics() {\n  if (navigator.vibrate) return\n  await import('ios-vibrator-pro-max')\n}",
          }}
          newFile={{
            name: 'src/haptics.ts',
            contents:
              "export async function bootHaptics() {\n  if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate\n  await import('ios-vibrator-pro-max@3.0.3')\n}",
          }}
        />
      </div>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the app's light / dark appearance.
export default function ChangeExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Change />
    </WorkbenchTheme>
  )
}
