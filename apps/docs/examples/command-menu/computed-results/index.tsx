import { useState } from 'react'
import {
  CommandMenu, CommandMenuFooter, CommandMenuGroup, CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem, CommandMenuList,
  CommandMenuPage, useCommandMenu,
} from '@/components/ui/command-menu'

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
    <CommandMenuGroup>
      <CommandMenuGroupLabel>Result</CommandMenuGroupLabel>
      <CommandMenuItem
        value="result"
        icon="number"
        title={shown}
        description={query ? query : 'Type an expression: (12 + 30) × 2'}
        disabled={value === null}
        onSelect={() => onCommit(`${query} = ${shown}`)}
      />
    </CommandMenuGroup>
  )
}

export default function ComputedResults() {
  const [history, setHistory] = useState<string[]>(['1440 ÷ 12 = 120'])
  return (
    <CommandMenu aria-label="Calculator" defaultPages={['calc']} style={{ width: 'min(480px, 100%)' }}>
      <CommandMenuInput />
      <CommandMenuList className="max-h-75">
        <CommandMenuPage>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Apps</CommandMenuGroupLabel>
            <CommandMenuItem icon="number" title="Calculator" page="calc" />
          </CommandMenuGroup>
        </CommandMenuPage>
        {/* filter={false}: the rows are computed from the search text rather than filtered by it.
            onKeyDown runs before the menu's own keys: "=" commits like Enter. */}
        <CommandMenuPage
          value="calc"
          title="Calculator"
          placeholder="Calculate…"
          filter={false}
          onKeyDown={(event, controller) => {
            if (event.key === '=') {
              event.preventDefault()
              controller.run('result')
            }
          }}
        >
          <Result onCommit={(line) => setHistory((h) => [line, ...h].slice(0, 5))} />
          <CommandMenuGroup>
            <CommandMenuGroupLabel>History</CommandMenuGroupLabel>
            {history.map((h, i) => (
              <CommandMenuItem key={`${h}-${i}`} value={`history-${i}`} icon="clock" title={h} />
            ))}
          </CommandMenuGroup>
        </CommandMenuPage>
      </CommandMenuList>
      <CommandMenuFooter legend={[{ keys: ['Enter'], label: 'Save' }, { keys: ['='], label: 'Save' }, { keys: ['Backspace'], label: 'Apps' }]} />
    </CommandMenu>
  )
}
