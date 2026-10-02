import { CronEditor } from '@/components/ui/cron-editor'

// `naturalLanguage={false}` never loads gpu-cron or asks for WebGPU: just the
// expression, its fields, the description, your presets and the next runs.
// Names (jan, mon) and the @daily-style macros work in the expression too.
const presets = [
  { label: 'Nightly backup', value: '0 2 * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Weekends at 10:00', value: '0 10 * * sat,sun' },
  { label: 'Quarterly', value: '0 0 1 jan,apr,jul,oct *' },
]

export default function RawOnly() {
  return (
    <div className="mx-auto max-w-md">
      <CronEditor
        naturalLanguage={false}
        variant="plain"
        presets={presets}
        defaultValue="*/15 9-17 * * mon-fri"
        label="Schedule"
        description="Minute, hour, day of month, month, day of week."
        from="2026-10-02T10:00:00Z"
        timeZone="UTC"
        locale="en-US"
        nextRunCount={4}
      />
    </div>
  )
}
