import { Progress } from '@/components/ui/progress'

// Three sizes, the tones, a custom value format, and the indeterminate bar
// (no `value`). `label` names the bar; `showValue` puts the value opposite it.
export default function Variants() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <Progress label="Uploading 12 photos" showValue value={38} />
      <Progress label="Backup complete" showValue value={100} tone="success" size="sm" />
      <Progress label="Storage almost full" showValue value={92} tone="destructive" size="lg" />
      <Progress
        label="Songs synced"
        showValue
        value={18}
        maxValue={24}
        formatOptions={{ style: 'decimal' }}
      />
      <Progress label="Preparing…" isIndeterminate />
      <Progress aria-label="Without a visible label" value={64} size="sm" />
    </div>
  )
}
