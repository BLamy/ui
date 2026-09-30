import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

const usage = [
  { label: 'Seats', used: 8, cap: 10 },
  { label: 'Projects', used: 14, cap: 25 },
  { label: 'Storage', used: 41, cap: 50, unit: ' GB' },
]

// A realistic settings card: header, a content body that takes its own
// layout, and a footer row of actions. Upgrading swaps the plan in place.
export default function Plan() {
  const [plan, setPlan] = useState<'Team' | 'Business'>('Team')
  const scale = plan === 'Business' ? 4 : 1
  return (
    <div className="mx-auto max-w-md rounded-card bg-muted p-5">
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{plan} plan</CardTitle>
          <CardDescription>
            {plan === 'Team' ? '$24 per seat, billed monthly' : '$48 per seat, billed yearly'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {usage.map((u) => {
            const cap = u.cap * scale
            const pct = Math.round((u.used / cap) * 100)
            return (
              <div key={u.label} className="grid gap-1">
                <div className="flex justify-between text-footnote">
                  <span className="text-foreground">{u.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {u.used}
                    {u.unit} of {cap}
                    {u.unit}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full bg-primary transition-[width] duration-500',
                      pct > 80 && 'bg-destructive',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
        <CardFooter>
          <Button
            size="sm"
            isDisabled={plan === 'Business'}
            onPress={() => setPlan('Business')}
          >
            {plan === 'Business' ? 'Current plan' : 'Upgrade'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={plan === 'Team'}
            onPress={() => setPlan('Team')}
          >
            Downgrade
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
