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
import { Field, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

const cities = ['Amsterdam', 'Barcelona', 'Berlin', 'Copenhagen', 'Lisbon', 'London', 'Madrid', 'Paris', 'Prague', 'Tokyo']

// `presentation="sheet"` always opens a bottom sheet: the grabber, the input in its header, and 44px rows.
// `"auto"` does that only on a small touch screen.
export default function Sheet() {
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-4">
      <Field>
        <FieldLabel>City</FieldLabel>
        <Combobox presentation="sheet">
          <ComboboxInputGroup>
            <ComboboxInput placeholder="Search cities" />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>No cities found.</ComboboxEmpty>
            <ComboboxList>
              {cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
    </ThemeScope>
  )
}
