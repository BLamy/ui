import { useState, type ReactNode } from 'react'
import {
  Button,
  FloatingSheet,
  ProgressStepper,
  springs,
  useAppearance,
  useMotion,
} from '@brett_lamy/ui'

const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
]

const row = { display: 'flex', justifyContent: 'space-between' } as const

// Each tray sets its own peek, so the sheet's height morphs between them.
const trays: { id: string; title: string; peek: number; body: ReactNode }[] = [
  {
    id: 'review',
    title: 'Review order',
    peek: 130,
    body: (
      <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
        <div style={row}>
          <span>2× Flat white</span>
          <strong>$9.00</strong>
        </div>
        <div style={row}>
          <span>1× Almond croissant</span>
          <strong>$4.75</strong>
        </div>
      </div>
    ),
  },
  {
    id: 'pay',
    title: 'Pay with',
    peek: 250,
    body: (
      <div style={{ display: 'grid', gap: 8 }}>
        {['Apple Pay', 'Visa ···· 4242', 'Add a card'].map((m, i) => (
          <div
            key={m}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(120,120,128,.14)',
              fontSize: 14,
              fontWeight: i === 0 ? 700 : 500,
            }}
          >
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

// Content slides the way the flow moves: forward from the right, back from the
// left.
const slide = {
  enter: (dir: number) => ({ x: dir * 60, opacity: 0, filter: 'blur(3px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: dir * -60, opacity: 0, filter: 'blur(3px)' }),
}

/** A 430×560 host with colour for the glass to blur; follows the appearance. */
function Host({ children, note }: { children?: ReactNode; note: string }) {
  const dark = useAppearance() === 'dark'
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          height: 560,
          borderRadius: 12,
          overflow: 'hidden',
          fontFamily: 'var(--bl-font)',
          background: dark
            ? 'radial-gradient(circle at 70% 18%, #2b2f4a, #0f1017 62%)'
            : 'radial-gradient(circle at 70% 18%, #fff4e6, #e8ecf3 62%)',
          color: dark ? '#f5f5f7' : '#1c1c1e',
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}
      >
        <div style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '.08em',
              opacity: 0.6,
            }}
          >
            HOST CONTENT
          </div>
          <p
            style={{
              margin: '8px 0 0',
              maxWidth: 340,
              lineHeight: 1.5,
              opacity: 0.8,
              fontSize: 14,
            }}
          >
            {note}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginTop: 18,
            }}
          >
            {[
              '#0A84FF',
              '#FF9F0A',
              '#30D158',
              '#BF5AF2',
              '#FF375F',
              '#64D2FF',
            ].map((c) => (
              <div
                key={c}
                style={{
                  height: 64,
                  borderRadius: 14,
                  background: c,
                  opacity: dark ? 0.75 : 0.6,
                }}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

// One sheet, several trays: the height springs between steps rather than
// jumping.
export default function Trays() {
  // useMotion() hands back framer-motion (AnimatePresence, motion) through the
  // kit.
  const { AnimatePresence, motion } = useMotion()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }
  const tray = trays[step]
  const last = step === trays.length - 1
  return (
    <Host
      note={
        'Continue and Back move through the trays: each has its own height, ' +
        'and the sheet morphs between them while the content slides the way ' +
        'the flow moves.'
      }
    >
      <FloatingSheet
        peek={tray.peek}
        appearance="sheet"
        minimizable={false}
        gutter={12}
        radius={26}
        label="Checkout"
        hideOnScroll={false}
      >
        <FloatingSheet.Body>
          <div style={{ padding: '2px 20px 20px', overflow: 'hidden' }}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={tray.id}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.smooth}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: 19 }}>
                  {tray.title}
                </h3>
                {tray.body}
              </motion.div>
            </AnimatePresence>
          </div>
        </FloatingSheet.Body>
        <FloatingSheet.Foot>
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px 16px' }}>
            <Button
              className="flex-1"
              variant="secondary"
              isDisabled={step === 0}
              onPress={() => go(step - 1)}
            >
              Back
            </Button>
            <Button className="flex-1" onPress={() => go(last ? 0 : step + 1)}>
              {last ? 'Start over' : 'Continue'}
            </Button>
          </div>
        </FloatingSheet.Foot>
      </FloatingSheet>
    </Host>
  )
}
