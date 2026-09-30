import { useState } from 'react'
import { Switch } from '@/components/ui/switch'

const rows = [
  { id: 'wifi', title: 'Wi-Fi sync', hint: 'Only sync over Wi-Fi' },
  { id: 'notify', title: 'Notifications', hint: 'Banners and sounds' },
  { id: 'beta', title: 'Beta features', hint: 'May change without notice' },
]

// Switch is controlled: `checked` + `onChange(boolean)`. It has no built-in
// text, so name it with aria-label — or aria-labelledby pointing at the row's
// own title, as here. (Inside a ListRow it finds the row title by itself.)
export default function Settings() {
  const [on, setOn] = useState<Record<string, boolean>>({ wifi: true, notify: true, beta: false })
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-card bg-card shadow-hairline">
      {rows.map((r, i) => (
        <div key={r.id} className={`flex items-center justify-between gap-4 px-4 py-3 ${i ? 'border-t border-border' : ''}`}>
          <div className="grid gap-0.5">
            <span id={`sw-${r.id}`} className="text-body text-foreground">{r.title}</span>
            <span className="text-footnote text-muted-foreground">{r.hint}</span>
          </div>
          <Switch aria-labelledby={`sw-${r.id}`} checked={on[r.id]} onChange={(v) => setOn((s) => ({ ...s, [r.id]: v }))} />
        </div>
      ))}
    </div>
  )
}
