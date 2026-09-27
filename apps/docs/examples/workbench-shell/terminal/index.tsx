import { TerminalAction, TerminalBody, TerminalHeader, WorkbenchTheme } from '@brett_lamy/ui'

function Terminal() {
  return (
    // a rounded window in the terminal's own background
    <div style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--wb-term)', boxShadow: '0 0 0 1px var(--wb-sep)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 300 }} className="wb-term">
        <TerminalHeader title="zsh">
          <TerminalAction icon="split" label="Split terminal" />
          <TerminalAction icon="plus" label="New terminal" />
        </TerminalHeader>
        <TerminalBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
      </div>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the app's light / dark appearance.
export default function TerminalExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Terminal />
    </WorkbenchTheme>
  )
}
