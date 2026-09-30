import { useState } from 'react'
import type { Key } from 'react-aria-components'
import { ComboBox, ComboBoxContent, ComboBoxInput, ComboBoxItem } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

interface Person { id: string; name: string; email: string }

const people: Person[] = [
  { id: 'ana', name: 'Ana Torres', email: 'ana@northwind.dev' },
  { id: 'kim', name: 'Kim Park', email: 'kim@northwind.dev' },
  { id: 'lee', name: 'Lee Chen', email: 'lee@northwind.dev' },
  { id: 'maya', name: 'Maya Okafor', email: 'maya@northwind.dev' },
  { id: 'sam', name: 'Sam Rivera', email: 'sam@northwind.dev' },
  { id: 'tomas', name: 'Tomás Silva', email: 'tomas@northwind.dev' },
]

// Dynamic items on the ComboBox itself; the built-in "contains" filter runs on
// each item's textValue. Controlled: `value` is the key, `inputValue` the text.
export default function Assignee() {
  const [value, setValue] = useState<Key | null>('kim')
  const [query, setQuery] = useState('Kim Park')
  const person = people.find((p) => p.id === value)
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-4">
      <ComboBox<Person>
        defaultItems={people}
        value={value}
        onChange={setValue}
        inputValue={query}
        onInputChange={setQuery}
        menuTrigger="focus"
        allowsEmptyCollection
      >
        <Label variant="field">Assignee</Label>
        <ComboBoxInput placeholder="Search the team" />
        <FieldDescription>
          {person ? `${person.name} will get a notification.` : 'Nobody assigned.'}
        </FieldDescription>
        <ComboBoxContent<Person> renderEmptyState={() => (
          <p className="m-0 px-3 py-2 text-subhead text-muted-foreground">No one matches “{query}”.</p>
        )}>
          {(p) => (
            <ComboBoxItem
              textValue={p.name}
              description={p.email}
              icon={<Icon name="person" size={22} />}
            >
              {p.name}
            </ComboBoxItem>
          )}
        </ComboBoxContent>
      </ComboBox>

      <ComboBox isDisabled defaultInputValue="Ana Torres">
        <Label variant="field">Reviewer (locked)</Label>
        <ComboBoxInput />
        <ComboBoxContent>
          <ComboBoxItem id="ana">Ana Torres</ComboBoxItem>
        </ComboBoxContent>
      </ComboBox>
    </ThemeScope>
  )
}
