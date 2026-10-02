import MacOS from '@/components/blocks/macos/page'

// `persist` keeps the desktop in localStorage: open a few apps, drag them (to an edge to snap), zoom one, right-click
// the Dock to hide it — then reload. Windows, their order and the Dock's preferences come back.
export default function Persistent() {
  return (
    <div style={{ height: '100dvh', minHeight: 560 }}>
      <MacOS persist="bl-macos-demo" defaultOpen={false} record={false} />
    </div>
  )
}
