import { ThemeScope, WorkbenchTheme } from '@brett_lamy/ui'
import { TerminalAction, TerminalBody, TerminalHeader } from '@/components/blocks/t3-clone/components/workbench/terminal'

function Terminal() {
  return (
    // a rounded window: the terminal is a `terminal` theme scope, dark in
    // either appearance
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <ThemeScope
        scope="terminal"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 300,
          background: 'var(--background)',
          color: 'var(--foreground)',
        }}
      >
        <TerminalHeader title="zsh">
          <TerminalAction icon="rectangle-split" label="Split terminal" />
          <TerminalAction icon="plus" label="New terminal" />
        </TerminalHeader>
        <TerminalBody
          seed={[
            { t: 'help', p: true },
            { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' },
          ]}
        />
      </ThemeScope>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function TerminalExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Terminal />
    </WorkbenchTheme>
  )
}
