import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
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
        foreground: '#F5F0FA',
        card: '#1D1426',
        'card-foreground': '#F5F0FA',
        popover: '#261A33',
        'popover-foreground': '#F5F0FA',
        'muted-foreground': '#BEB3C8',
        secondary: 'rgba(255,255,255,.12)',
        'secondary-foreground': '#F5F0FA',
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
        min={0}
        max={24}
        value={radius}
        onValueChange={setRadius}
      />
      <div className="flex gap-3">
        <Button>Save</Button>
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Options</PopoverTrigger>
          <PopoverContent side="bottom" align="start">
            <PopoverTitle className="sr-only">Options</PopoverTitle>
            <p className="m-0 text-detail text-muted-foreground">
              This popover opened inside the scope, so it reads the scope&apos;s{' '}
              <code>--popover</code>, <code>--primary</code> and{' '}
              <code>--radius</code>.
            </p>
            <Button size="sm" className="mt-3">
              Primary follows the tint
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </ThemeScope>
  )
}
