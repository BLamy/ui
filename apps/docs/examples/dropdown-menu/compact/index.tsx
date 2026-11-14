import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeScope } from '@/lib/theme'

const EFFORT = [
  { value: 'low', label: 'Low', description: 'Fastest answers' },
  { value: 'medium', label: 'Medium', description: 'Balanced' },
  { value: 'high', label: 'High', description: 'Most thorough' },
]

// `size="sm"` on the content: 32px rounded rows of footnote text and hairline
// separators, for a desktop toolbar or a composer's option pill. Rows, labels and
// separators inside (submenus too) follow it.
export default function Compact() {
  const [effort, setEffort] = useState('medium')
  const current = EFFORT.find((e) => e.value === effort) ?? EFFORT[1]
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>Effort: {current.label}</DropdownMenuTrigger>
        <DropdownMenuContent size="sm" align="start">
          <DropdownMenuRadioGroup value={effort} onValueChange={setEffort}>
            <DropdownMenuGroupLabel>Reasoning effort</DropdownMenuGroupLabel>
            {EFFORT.map((e) => (
              <DropdownMenuRadioItem key={e.value} value={e.value} description={e.description} closeOnSelect>
                {e.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="settings" shortcut="mod+,">Settings…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ThemeScope>
  )
}
