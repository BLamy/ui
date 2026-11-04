import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Terminal } from '@/components/ui/terminal'
import { createTerminalShell } from '@/lib/terminal-line'

// Kept outside the component: its output, its history and the half-typed line are all still there when a new Terminal
// picks it up. Type something, hide it and show it again.
const shell = createTerminalShell({
  prompt: '$ ',
  greeting: 'This session lives outside React.',
  onCommand: (line, io) => { io.write(`you ran: ${line}\n`) },
})

export default function Session() {
  const [shown, setShown] = useState(true)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-2">
      <Button size="sm" variant="secondary" onPress={() => setShown((now) => !now)}>{shown ? 'Unmount it' : 'Mount it again'}</Button>
      <div className="h-48 w-full overflow-hidden rounded-xl border border-border">
        {shown ? <Terminal shell={shell} /> : null}
      </div>
    </div>
  )
}
