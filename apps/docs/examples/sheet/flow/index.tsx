import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetBackdrop,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { BLProvider, ThemeScope } from '@/lib/theme'

const plans = [
  { id: 'free', name: 'Starter', price: '$0', blurb: '3 projects, community support' },
  { id: 'team', name: 'Team', price: '$12', blurb: 'Unlimited projects, priority support' },
]

// `animateHeight` springs the sheet to its content's height as a short flow
// steps forward — pick a plan, confirm. The sheet is opened inside a
// ThemeScope with its own tint; popups wear the scope they open in, so the
// primary button and focus ring here are teal although the page's are not.
// "Confirm and pay" is a SheetClose rendered as a Button: its `action` runs,
// then the sheet closes.
export default function Flow() {
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')
  const [plan, setPlan] = useState(plans[1])
  const [done, setDone] = useState<string | null>(null)
  return (
    <div className="mx-auto h-[420px] max-w-md overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <ThemeScope tint="#30B0C7" className="grid h-full content-start gap-4 p-5">
          <Sheet onOpenChange={(open) => open && setStep('pick')}>
            <SheetTrigger className={cn(buttonVariants(), 'justify-self-start')}>Upgrade plan</SheetTrigger>
            <SheetBackdrop />
            <SheetContent animateHeight>
              {step === 'pick' ? (
                <>
                  <SheetClose />
                  <SheetHeader>
                    <SheetTitle>Choose a plan</SheetTitle>
                    <SheetDescription>You can change it any time.</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-2 px-5 py-2">
                    {plans.map((p) => (
                      <Button
                        key={p.id}
                        variant={p.id === plan.id ? 'default' : 'secondary'}
                        size="lg"
                        className="h-auto justify-between py-3"
                        onClick={() => setPlan(p)}
                      >
                        <span className="text-left">
                          <span className="block">{p.name}</span>
                          <span className="block text-footnote font-normal opacity-80">{p.blurb}</span>
                        </span>
                        <span>{p.price}</span>
                      </Button>
                    ))}
                  </div>
                  <SheetFooter>
                    <Button size="pill" onClick={() => setStep('confirm')}>Continue</Button>
                  </SheetFooter>
                </>
              ) : (
                <>
                  <SheetClose />
                  <SheetHeader>
                    <SheetTitle>Confirm {plan.name}</SheetTitle>
                    <SheetDescription>
                      {plan.price} per seat each month, billed today.
                    </SheetDescription>
                  </SheetHeader>
                  <SheetFooter>
                    <SheetClose render={<Button size="pill" />} action={() => setDone(plan.name)}>
                      Confirm and pay
                    </SheetClose>
                    <Button size="pill" variant="ghost" onClick={() => setStep('pick')}>Back</Button>
                  </SheetFooter>
                </>
              )}
            </SheetContent>
          </Sheet>
          <p className="m-0 text-footnote text-muted-foreground" aria-live="polite">
            {done ? `Upgraded to ${done}.` : 'On the free plan.'}
          </p>
        </ThemeScope>
      </BLProvider>
    </div>
  )
}
