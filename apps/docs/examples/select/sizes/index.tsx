import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select'
import { ThemeScope } from '@/lib/theme'

const repeats = ['Never', 'Every day', 'Every week', 'Every 2 weeks', 'Every month']

// The trigger is the kit's filled field, so a Select sits in a row of Inputs at
// the same height: 32, 44 and 50px. `size="sm"` on SelectContent makes the rows
// dense too (32px, footnote text), for an inspector or a toolbar.
export default function Sizes() {
  return (
    <ThemeScope className="mx-auto grid max-w-md gap-3">
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <div key={size} className="grid grid-cols-2 gap-2">
          <Input size={size} aria-label={`Title, ${size}`} placeholder="Title" />
          <Select items={repeats} defaultValue="Every week">
            <SelectTrigger size={size} aria-label={`Repeat, ${size}`} />
            <SelectContent size={size === 'sm' ? 'sm' : 'default'} />
          </Select>
        </div>
      ))}
    </ThemeScope>
  )
}
