import { useState } from 'react'
import { Breadcrumb } from '@/components/ui/breadcrumb'

// The last item is the current page: aria-current, and not pressable. Give it
// a handler (or an href) and it is a button again — here it refreshes the page.
export default function CurrentAction() {
  const [loads, setLoads] = useState(1)
  return (
    <div className="mx-auto grid max-w-md gap-3 p-2">
      <Breadcrumb
        items={[
          { id: 'home', label: 'Home', icon: 'house', href: '#home' },
          { id: 'reports', label: 'Reports', href: '#reports' },
          { id: 'weekly', label: 'Weekly report', onPress: () => setLoads((n) => n + 1) },
        ]}
      />
      <p className="text-footnote text-muted-foreground">Loaded {loads} {loads === 1 ? 'time' : 'times'}. Press the current page to reload it.</p>
    </div>
  )
}
