import { ReplayPreview, replayDemoEvents } from '@/components/ui/replay-preview'

export function ComponentExample({ label = 'A real component export' }: { label?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: 'var(--muted)', color: 'var(--foreground)' }}>
      <strong>{label}</strong>
      <p style={{ margin: '6px 0 0' }}>This preview comes from fixtures.tsx.</p>
    </div>
  )
}

export const Primary = {
  args: { label: 'A Storybook story with its own args' },
  render: ComponentExample,
}

export function ReplayExample() {
  return <ReplayPreview events={replayDemoEvents} initialTime={6400} title="Kitchen sink replay" />
}
