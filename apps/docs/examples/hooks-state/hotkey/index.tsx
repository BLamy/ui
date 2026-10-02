import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useHotkey } from '@/components/ui/command-menu'

// useHotkey listens on the document, so focus can be anywhere on the page. It
// calls preventDefault() on a match and skips events something else already
// handled. `mod` is Command on Apple platforms and Ctrl elsewhere.
export default function Hotkey() {
  const [enabled, setEnabled] = useState(true)
  const [palette, setPalette] = useState(false)
  const [presses, setPresses] = useState(0)
  const [last, setLast] = useState('none yet')

  useHotkey('mod+e', () => setPalette((open) => !open), enabled)
  useHotkey(
    'alt+j',
    (event) => {
      setPresses((n) => n + 1)
      // The handler gets the KeyboardEvent.
      setLast(event.code)
    },
    enabled,
  )

  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <span id="hk-enabled" className="text-body text-foreground">
          Hotkeys on
        </span>
        <Switch aria-labelledby="hk-enabled" checked={enabled} onChange={setEnabled} />
      </div>
      <div className="grid gap-3 rounded-card bg-card p-4 shadow-hairline">
        <div className="flex items-center justify-between gap-3 text-subhead text-foreground">
          <span>Toggle the palette</span>
          <code className="font-mono">⌘ / Ctrl + E</code>
        </div>
        <div className="flex items-center justify-between gap-3 text-subhead text-foreground">
          <span>Count a press</span>
          <code className="font-mono">Alt / ⌥ + J</code>
        </div>
      </div>
      <div className="rounded-card bg-secondary p-4 text-subhead text-foreground" aria-live="polite">
        Palette: {palette ? 'open' : 'closed'}. Alt+J pressed {presses} times (last event.code: {last}).
      </div>
    </div>
  )
}
