import { useState } from 'react'
import {
  CommandMenu, CommandMenuEmpty, CommandMenuFooter, CommandMenuGroup, CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem,
  CommandMenuList, useCommandMenuValue,
} from '@/components/ui/command-menu'

const smileys: [string, string][] = [
  ['😀', 'grinning'], ['😂', 'joy'], ['🥹', 'holding back tears'], ['😍', 'heart eyes'], ['🤔', 'thinking'],
  ['😎', 'sunglasses cool'], ['🥳', 'party'], ['😴', 'sleeping'], ['🙃', 'upside down'], ['😬', 'grimacing'],
  ['🤯', 'mind blown'], ['🫠', 'melting'], ['😇', 'halo innocent'], ['🤓', 'nerd'],
]
const gestures: [string, string][] = [
  ['👍', 'thumbs up'], ['👏', 'clap'], ['🙏', 'pray thanks'], ['👋', 'wave hello'], ['🤝', 'handshake'],
  ['✌️', 'victory peace'], ['🫶', 'heart hands'], ['💪', 'strong flex'], ['🔥', 'fire'], ['✨', 'sparkles'],
  ['🎉', 'tada party'], ['❤️', 'heart love'], ['💯', 'hundred'], ['🚀', 'rocket ship'],
]

/** The footer reads the highlighted cell: useCommandMenuValue() is the highlighted command's value. */
function ActiveName() {
  const value = useCommandMenuValue()
  const name = value?.split(' ').slice(1).join(' ')
  const shortcode = name ? `:${name.replace(/ /g, '_')}:` : ''
  return <span className="truncate" title={shortcode} style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{shortcode}</span>
}

export default function EmojiGrid() {
  const [picked, setPicked] = useState<string[]>([])
  const cell = ([e, name]: [string, string]) => (
    // The cell shows only the emoji, so `label` says what the search matches.
    <CommandMenuItem key={e} value={`${e} ${name}`} label={name} onSelect={() => setPicked((p) => [e, ...p].slice(0, 12))}>
      <span style={{ fontSize: 24, lineHeight: 1 }}>{e}</span>
    </CommandMenuItem>
  )
  return (
    <div style={{ display: 'grid', gap: 12, width: 'min(460px, 100%)' }}>
      <CommandMenu aria-label="Emoji">
        <CommandMenuInput placeholder="Search emoji…" />
        <CommandMenuEmpty>No emoji found</CommandMenuEmpty>
        <CommandMenuList className="max-h-70">
          {/* columns: ← → move within the grid, ↑ ↓ move a row and leave it at the edges */}
          <CommandMenuGroup columns={7}>
            <CommandMenuGroupLabel>Smileys</CommandMenuGroupLabel>
            {smileys.map(cell)}
          </CommandMenuGroup>
          <CommandMenuGroup columns={7}>
            <CommandMenuGroupLabel>Gestures & symbols</CommandMenuGroupLabel>
            {gestures.map(cell)}
          </CommandMenuGroup>
        </CommandMenuList>
        <CommandMenuFooter legend={[{ keys: ['←', '→', '↑', '↓'], label: 'Move' }, { keys: ['Enter'], label: 'Pick' }]}>
          <ActiveName />
        </CommandMenuFooter>
      </CommandMenu>
      <div style={{ minHeight: 28, fontSize: 22, letterSpacing: 4 }}>{picked.join('')}</div>
    </div>
  )
}
