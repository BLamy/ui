import { useState, type ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { AppearanceProvider, ThemeScope, useAppearance, useThemeScopeProps } from '@/lib/theme'

// What each hook sees. useAppearance() reads the AppearanceProvider (or the
// page's `.dark` class) — a ThemeScope does not publish its own appearance to
// it. useThemeScopeProps() reads the nearest ThemeScope, which is what a
// portalled overlay spreads onto its root to wear the same scope.
function Probe({ label }: { label: string }) {
  const appearance = useAppearance()
  const scope = useThemeScopeProps()
  return (
    <div className="grid gap-0.5 text-footnote">
      <span className="font-semibold text-foreground">{label}</span>
      <code className="font-mono text-foreground">useAppearance() → {String(appearance)}</code>
      <code className="font-mono text-foreground">
        useThemeScopeProps().className → {scope.className ? `"${scope.className}"` : 'undefined'}
      </code>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 rounded-card border border-border bg-background p-3 text-foreground">{children}</div>
}

export default function Appearance() {
  const [dark, setDark] = useState(true)
  return (
    <div className="mx-auto grid max-w-md gap-4">
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <span id="ap-dark" className="text-body text-foreground">
          AppearanceProvider: dark
        </span>
        <Switch aria-labelledby="ap-dark" checked={dark} onChange={setDark} />
      </div>
      <AppearanceProvider value={dark ? 'dark' : 'light'}>
        <ThemeScope>
          <Panel>
            <Probe label="A ThemeScope with no appearance of its own" />
            <ThemeScope appearance={dark ? 'light' : 'dark'}>
              <Panel>
                <Probe label="A nested ThemeScope, the opposite appearance" />
              </Panel>
            </ThemeScope>
          </Panel>
        </ThemeScope>
      </AppearanceProvider>
    </div>
  )
}
