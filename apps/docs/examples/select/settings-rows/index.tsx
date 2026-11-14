import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select'
import { ThemeScope } from '@/lib/theme'

const repeats = ['Never', 'Every day', 'Every week', 'Every 2 weeks', 'Every month']
const alerts = ['None', 'At time of event', '5 minutes before', '1 hour before', '1 day before']

function Row({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div className="flex min-h-11 flex-row items-center justify-between gap-2 border-b border-border last:border-b-0">
      <span className="text-body text-foreground" aria-hidden="true">{label}</span>
      <Select items={options} value={value} onValueChange={(next) => { if (next !== null) onChange(next) }}>
        <SelectTrigger aria-label={label} variant="plain" />
        <SelectContent align="end" />
      </Select>
    </div>
  )
}

// `variant="plain"` is the iOS pop-up button: no fill, a muted value at the
// trailing edge of a grouped-list row. The list opens toward that edge.
export default function SettingsRows() {
  const [repeat, setRepeat] = useState('Every week')
  const [alert, setAlert] = useState('1 hour before')
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto max-w-sm">
      <Card className="px-4">
        <Row label="Repeat" value={repeat} onChange={setRepeat} options={repeats} />
        <Row label="Alert" value={alert} onChange={setAlert} options={alerts} />
      </Card>
    </ThemeScope>
  )
}
