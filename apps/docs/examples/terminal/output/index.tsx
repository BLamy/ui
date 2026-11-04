import { Terminal } from '@/components/ui/terminal'

const LOG = [
  '\x1b[1mnpm run build\x1b[0m',
  '',
  '\x1b[32m✓\x1b[0m 412 modules transformed.',
  '\x1b[2mdist/\x1b[0mindex.html             \x1b[2m0.46 kB\x1b[0m',
  '\x1b[2mdist/assets/\x1b[0m\x1b[35mindex.css\x1b[0m        \x1b[2m18.20 kB\x1b[0m',
  '\x1b[2mdist/assets/\x1b[0m\x1b[36mindex.js\x1b[0m        \x1b[2m142.87 kB\x1b[0m',
  '\x1b[33mwarning\x1b[0m: 1 chunk is larger than 100 kB',
  '\x1b[31merror\x1b[0m: failed to resolve "./missing"',
  '\x1b[34minfo\x1b[0m: a line long enough to wrap when this terminal is narrow, and to wrap back when it widens again',
  '',
].join('\r\n')

// Drag the corner: the grid refits, and long lines wrap again rather than getting cut off.
export default function Output() {
  return (
    <div className="mx-auto h-64 w-full max-w-2xl min-w-48 resize-x overflow-hidden rounded-xl border border-border">
      <Terminal readOnly onReady={(terminal) => terminal.write(LOG)} />
    </div>
  )
}
