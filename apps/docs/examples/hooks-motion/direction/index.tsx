import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDirection, useMotion, useSpringTransition } from '@/lib/motion'

const STEPS = ['Account', 'Plan', 'Payment', 'Done']

// useDirection(step) is -1, 0 or 1 and stays put between changes, so the panel
// that is leaving reads the same direction as the one arriving. useSpringTransition
// hands back a spring, or an instant transition under reduced motion.
// (useMotion returns the framer-motion module; a plain `import … from 'framer-motion'`
// works the same.)
export default function Direction() {
  const { AnimatePresence, motion } = useMotion()
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
        <Button variant="secondary" size="sm" isDisabled={step === 0} onPress={() => setStep((s) => s - 1)}>
          Back
        </Button>
        <span className="text-footnote text-foreground tabular-nums">
          step {step}, useDirection → {dir}
        </span>
        <Button variant="secondary" size="sm" isDisabled={step === STEPS.length - 1} onPress={() => setStep((s) => s + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}
