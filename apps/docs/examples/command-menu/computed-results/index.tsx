import { useState } from 'react'
import { CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList, CommandMenu, CommandPage, useCommandMenu } from '@/components/ui/command-menu'

/** + − × ÷ and parentheses, without eval. Returns null until the input is a whole expression. */
function evaluate(src: string): number | null {
  const tokens = src.replace(/×/g, '*').replace(/÷/g, '/').match(/\d*\.?\d+|[-+*/()]/g)
  if (!tokens || tokens.join('') !== src.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/')) return null
  let i = 0
  const peek = () => tokens[i]
  const atom = (): number => {
    const t = tokens[i++]
    if (t === '-') return -atom()
    if (t === '(') {
      const v = sum()
      if (tokens[i++] !== ')') throw new Error('paren')
      return v
    }
    const n = Number(t)
    if (Number.isNaN(n)) throw new Error('nan')
    return n
  }
  const product = (): number => {
    let v = atom()
    while (peek() === '*' || peek() === '/') v = tokens[i++] === '*' ? v * atom() : v / atom()
    return v
  }
  const sum = (): number => {
    let v = product()
    while (peek() === '+' || peek() === '-') v = tokens[i++] === '+' ? v + product() : v - product()
    return v
  }
  try {
    const v = sum()
    return i === tokens.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function Result({ onCommit }: { onCommit: (line: string) => void }) {
  const { query } = useCommandMenu()
  const value = evaluate(query)
  const shown = value === null ? '—' : Number(value.toPrecision(12)).toLocaleString('en-US')
  return (
    <CommandGroup heading="Result">
      <CommandItem
        value="result"
        icon="number"
        title={shown}
        description={query ? query : 'Type an expression: (12 + 30) × 2'}
        disabled={value === null}
        closeOnSelect={false}
        onSelect={() => onCommit(`${query} = ${shown}`)}
      />
    </CommandGroup>
  )
}

export default function ComputedResults() {
  const [history, setHistory] = useState<string[]>(['1440 ÷ 12 = 120'])
  return (
    <CommandMenu aria-label="Calculator" defaultPages={['calc']} style={{ width: 'min(480px, 100%)' }}>
      <CommandInput />
      <CommandList maxHeight={300}>
        <CommandPage id="root">
          <CommandGroup heading="Apps">
            <CommandItem icon="number" title="Calculator" page="calc" />
          </CommandGroup>
        </CommandPage>
        {/* filter={false}: the rows are computed from the query rather than filtered by it.
            onKeyDown runs before the menu's own keys: "=" commits like Enter. */}
        <CommandPage
          id="calc"
          title="Calculator"
          placeholder="Calculate…"
          filter={false}
          onKeyDown={(e, menu) => {
            if (e.key === '=') {
              e.preventDefault()
              menu.select('result')
            }
          }}
        >
          <Result onCommit={(line) => setHistory((h) => [line, ...h].slice(0, 5))} />
          <CommandGroup heading="History">
            {history.map((h, i) => (
              <CommandItem key={`${h}-${i}`} value={`history-${i}`} icon="clock" title={h} closeOnSelect={false} />
            ))}
          </CommandGroup>
        </CommandPage>
      </CommandList>
      <CommandFooter legend={[{ keys: ['Enter'], label: 'Save' }, { keys: ['='], label: 'Save' }, { keys: ['Backspace'], label: 'Apps' }]} />
    </CommandMenu>
  )
}
