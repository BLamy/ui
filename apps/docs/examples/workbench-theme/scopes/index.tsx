import { useState } from 'react'
import { useWorkbenchAppearance, WorkbenchTheme } from '@/components/ui/workbench-theme'
import { Segmented } from '@/components/ui/segmented'
import {
  AssistantMessage,
  MessageMarkdown,
  ToolCall,
  UserMessage,
  WorkLog,
} from '@/components/ui/conversation'

// Any Workbench part reads its colors from the `workbench` scope. Reading the
// resolved appearance is for third-party renderers that need it as a prop.
function Appearance() {
  const appearance = useWorkbenchAppearance()
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">
      useWorkbenchAppearance() → {appearance}
    </span>
  )
}

function Sample() {
  return (
    <div className="grid gap-1">
      <UserMessage>Why is the build slow?</UserMessage>
      <AssistantMessage>
        <WorkLog summary="Worked for 12s" defaultOpen>
          <ToolCall icon="doc-text" title="Read" detail="vite.config.ts" />
          <ToolCall status="running" title="Profiling" detail="vite build" />
        </WorkLog>
        <MessageMarkdown markdown="The config pulls in `@babel/core` for every file. Drop it and the **cold build** halves." />
      </AssistantMessage>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded-full bg-primary px-3 py-1 text-caption font-semibold text-primary-foreground">Apply fix</span>
        <span className="rounded-lg bg-code px-2.5 py-1 font-mono text-caption text-code-foreground">pnpm nx build docs</span>
      </div>
    </div>
  )
}

const TINTS = [
  { id: 'default', label: 'Theme' },
  { id: '#30d158', label: 'Green' },
  { id: '#ff9f0a', label: 'Orange' },
]

// Explicit `appearance` always wins, so two scopes can sit side by side on one
// page; `tint` replaces --primary and --ring inside the scope.
export default function Scopes() {
  const [tint, setTint] = useState('default')
  const t = tint === 'default' ? undefined : tint
  return (
    <div className="grid gap-3">
      <Segmented aria-label="Accent" value={tint} onChange={setTint} options={TINTS} className="mx-auto" />
      <div className="grid gap-3 sm:grid-cols-2">
        {(['light', 'dark'] as const).map((appearance) => (
          <WorkbenchTheme key={appearance} appearance={appearance} tint={t} className="grid gap-3 rounded-card border border-border p-4">
            <div className="flex items-center gap-2">
              <span className="text-footnote font-semibold capitalize">{appearance}</span>
              <Appearance />
            </div>
            <Sample />
          </WorkbenchTheme>
        ))}
      </div>
    </div>
  )
}
