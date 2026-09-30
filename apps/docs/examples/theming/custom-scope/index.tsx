import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { ThemeScope } from '@/lib/theme'

// `vars` sets theme variables on the scope root, by name without the dashes.
// The popover renders in a portal but wears the same scope, so it is dark,
// pink and as square as the card that opened it.
export default function CustomScope() {
  const [radius, setRadius] = useState(4)
  return (
    <ThemeScope
      scope="brand"
      appearance="dark"
      tint="#FF375F"
      vars={{
        radius: `${radius}px`,
        background: '#120C18',
        card: '#1D1426',
        popover: '#261A33',
        border: 'rgba(255,255,255,.16)',
      }}
      className="mx-auto grid max-w-md gap-4 rounded-card bg-background p-5 text-foreground shadow-hairline"
    >
      <div className="flex items-center gap-2">
        <strong className="flex-1 text-body">Brand scope</strong>
        <Badge variant="tinted">--radius {radius}px</Badge>
      </div>
      <Slider
        label="Corner radius"
        minValue={0}
        maxValue={24}
        value={radius}
        onChange={setRadius}
      />
      <div className="flex gap-3">
        <Button>Save</Button>
        <PopoverTrigger>
          <Button variant="secondary">Options</Button>
          <PopoverContent aria-label="Options" placement="bottom start">
            <p className="m-0 text-detail text-muted-foreground">
              This popover opened inside the scope, so it reads the scope&apos;s{' '}
              <code>--popover</code>, <code>--primary</code> and{' '}
              <code>--radius</code>.
            </p>
            <Button size="sm" className="mt-3">
              Primary follows the tint
            </Button>
          </PopoverContent>
        </PopoverTrigger>
      </div>
    </ThemeScope>
  )
}
