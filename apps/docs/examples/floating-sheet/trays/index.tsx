import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { FloatingSheet, FloatingSheetBody, FloatingSheetFooter } from '@/components/ui/floating-sheet'
import { ProgressStepper } from '@/components/ui/progress-stepper'
import { SheetBack, SheetHeader, SheetTitle, SheetView } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
]

// Each tray sets its own peek, so the sheet's height springs between them.
const trays: { id: string; title: string; peek: number; body: ReactNode }[] = [
  {
    id: 'review',
    title: 'Review order',
    peek: 120,
    body: (
      <div className="grid gap-2 text-subhead">
        <div className="flex justify-between">
          <span>2× Flat white</span>
          <strong>$9.00</strong>
        </div>
        <div className="flex justify-between">
          <span>1× Almond croissant</span>
          <strong>$4.75</strong>
        </div>
      </div>
    ),
  },
  {
    id: 'pay',
    title: 'Pay with',
    peek: 230,
    body: (
      <div className="grid gap-2">
        {['Apple Pay', 'Visa ···· 4242', 'Add a card'].map((m, i) => (
          <div key={m} className={cn('rounded-ctl bg-secondary px-3.5 py-3 text-subhead', i === 0 && 'font-semibold')}>
            {m}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'done',
    title: 'Order placed',
    peek: 110,
    body: <ProgressStepper steps={steps} current={1} labels />,
  },
]

/** A 430×560 host with colour behind the sheet, in the page's tokens. */
function Host({ children, note }: { children?: ReactNode; note: string }) {
  return (
    <div className="relative mx-auto h-[560px] max-w-[430px] overflow-hidden rounded-card bg-muted font-sans text-foreground shadow-hairline">
      <div aria-hidden className="absolute -top-16 -right-10 size-72 rounded-full bg-warning/30 blur-3xl" />
      <div className="relative p-5">
        <div className="text-caption font-bold tracking-wider text-muted-foreground uppercase">Host content</div>
        <p className="mt-2 mb-0 max-w-[340px] text-subhead text-muted-foreground">{note}</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {['bg-primary/60', 'bg-warning/60', 'bg-success/60', 'bg-primary/30', 'bg-destructive/50', 'bg-success/30'].map((c) => (
            <div key={c} className={cn('h-16 rounded-card', c)} />
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

// One sheet, several trays: the kit's flow on a FloatingSheet, written with
// Sheet's flow parts. `view` names the step and each step sets its `peek`, so
// the height springs between steps; the bar header's title and the SheetView
// travel the way the flow moves (forward from the end, back from the start),
// and SheetBack folds into the bar once there is a step to go back to.
export default function Trays() {
  const [step, setStep] = useState(0)
  const tray = trays[step]
  const last = step === trays.length - 1
  return (
    <Host note="Continue and the back chevron move through the trays: each has its own height, and the sheet springs between them while the content travels the way the flow moves.">
      <FloatingSheet view={tray.id} peek={tray.peek} variant="card" collapse="none" aria-label="Checkout" hideOnScroll={false}>
        <FloatingSheetBody>
          {/* The body takes one child, the height of its window. */}
          <div>
            <SheetHeader variant="bar" className="pt-1">
              <SheetBack hidden={step === 0} onClick={() => setStep(step - 1)} />
              <SheetTitle>{tray.title}</SheetTitle>
            </SheetHeader>
            <SheetView className="px-5 pb-5">{tray.body}</SheetView>
          </div>
        </FloatingSheetBody>
        <FloatingSheetFooter>
          <div className="flex px-4 pt-2 pb-4">
            <Button size="pill" className="flex-1" onClick={() => setStep(last ? 0 : step + 1)}>
              {last ? 'Start over' : 'Continue'}
            </Button>
          </div>
        </FloatingSheetFooter>
      </FloatingSheet>
    </Host>
  )
}
