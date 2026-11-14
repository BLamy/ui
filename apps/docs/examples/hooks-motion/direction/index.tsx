import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { useDirection, useSpringTransition } from '@/lib/motion'

const STEPS = ['Account', 'Plan', 'Payment', 'Done']

// useDirection(step) is -1, 0 or 1 and stays put between changes, so the panel
// that is leaving reads the same direction as the one arriving. useSpringTransition
// hands back a spring, or an instant transition under reduced motion.
export default function Direction() {
  const [step, setStep] = useState(0)
  const dir = useDirection(step)
  const transition = useSpringTransition('smooth')
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="relative h-24 overflow-hidden rounded-card bg-card shadow-hairline">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 48, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -48, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0 grid place-items-center text-title font-semibold text-foreground"
          >
            {STEPS[step]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <span className="text-footnote text-foreground tabular-nums">
          step {step}, useDirection → {dir}
        </span>
        <Button variant="secondary" size="sm" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
