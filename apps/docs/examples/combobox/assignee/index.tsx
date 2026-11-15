import { useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

interface Person { value: string; label: string; keywords: string[] }

// `keywords` match too: here, the email.
const people: Person[] = [
  { value: 'ana', label: 'Ana Torres', keywords: ['ana@northwind.dev'] },
  { value: 'kim', label: 'Kim Park', keywords: ['kim@northwind.dev'] },
  { value: 'lee', label: 'Lee Chen', keywords: ['lee@northwind.dev'] },
  { value: 'maya', label: 'Maya Okafor', keywords: ['maya@northwind.dev'] },
  { value: 'sam', label: 'Sam Rivera', keywords: ['sam@northwind.dev'] },
  { value: 'tomas', label: 'Tomás Silva', keywords: ['tomas@northwind.dev'] },
]

// Options as data on the Combobox, filtered by their label and keywords. The
// list draws the matches itself, so each row gets an icon and a description.
// `value` is the option; the text is only a query (`onQueryChange`).
export default function Assignee() {
  const [value, setValue] = useState<string | null>('kim')
  const [query, setQuery] = useState('')
  const person = people.find((p) => p.value === value)
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-4">
      <Field>
        <FieldLabel>Assignee</FieldLabel>
        <Combobox
          items={people}
          value={value}
          onValueChange={setValue}
          onQueryChange={setQuery}
        >
          <ComboboxInputGroup>
            <ComboboxInput placeholder="Search the team" />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>No one matches “{query}”.</ComboboxEmpty>
            <ComboboxList>
              {(state) => (state.items as Person[]).map((p) => (
                <ComboboxItem
                  key={p.value}
                  value={p.value}
                  label={p.label}
                  keywords={p.keywords}
                  description={p.keywords[0]}
                  icon={<Icon name="person" size={22} />}
                >
                  {p.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldDescription>
          {person ? `${person.label} will get a notification.` : 'Nobody assigned.'}
        </FieldDescription>
      </Field>

      <Field disabled>
        <FieldLabel>Reviewer (locked)</FieldLabel>
        <Combobox items={[{ value: 'ana', label: 'Ana Torres' }]} defaultValue="ana">
          <ComboboxInputGroup />
          <ComboboxContent />
        </Combobox>
      </Field>
    </ThemeScope>
  )
}
