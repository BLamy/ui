import { Terminal, type TerminalProps } from '@/components/ui/terminal'

const FILES: Record<string, string> = {
  'notes.txt': 'Milk\nEggs\n',
  'todo.txt': 'Ship the terminal\n',
}

const COMMANDS = ['cat', 'clear', 'count', 'echo', 'help', 'ls']

// Whatever takes a whole line can sit behind a prompt. The terminal does the line editing, the history and Ctrl-C.
const run: TerminalProps['onCommand'] = async (line, io) => {
  const [command, ...args] = line.trim().split(/\s+/)
  if (command === 'help') io.write(`Try: ${COMMANDS.join(', ')}. ↑ and ↓ walk the history, Tab completes, Ctrl-C stops count.\n`)
  else if (command === 'ls') io.write(`${Object.keys(FILES).join('  ')}\n`)
  else if (command === 'echo') io.write(`${args.join(' ')}\n`)
  else if (command === 'clear') io.clear()
  else if (command === 'cat') io.write(FILES[args[0]] ?? `cat: ${args[0]}: no such file\n`)
  else if (command === 'count') {
    // Output streams as it comes; the signal says when Ctrl-C was pressed.
    for (let n = 1; n <= 20 && !io.signal.aborted; n += 1) {
      io.write(`\x1b[32m${n}\x1b[0m\n`)
      await new Promise((done) => setTimeout(done, 300))
    }
  } else io.write(`\x1b[31m${command}: command not found\x1b[0m\n`)
}

export default function Commands() {
  return (
    <div className="mx-auto h-72 w-full max-w-2xl overflow-hidden rounded-xl border border-border">
      <Terminal
        prompt={'\x1b[34m~\x1b[0m $ '}
        greeting="Type help."
        onCommand={run}
        complete={({ word, line }) => (line.startsWith(word) ? COMMANDS : Object.keys(FILES)).filter((name) => name.startsWith(word))}
      />
    </div>
  )
}
