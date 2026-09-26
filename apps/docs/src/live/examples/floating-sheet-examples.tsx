/* FloatingSheet page — detents, an appearance that morphs in place, and Family-style trays whose height
   changes step to step. Registered in live-core.tsx. */
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, springs, useAppearance } from '@brett_lamy/ui';
import { FloatingSheet, ProgressStepper, useFloatingSheet, type FloatingSheetAppearance } from '@brett_lamy/chatkit';
import type { LiveSpec } from '../frame';

/** A 430×560 host with colour for the glass to blur; follows the docs appearance. */
function Host({ children, note }: { children?: ReactNode; note: string }) {
  const dark = useAppearance() === 'dark';
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative', height: 560, borderRadius: 12, overflow: 'hidden', fontFamily: 'var(--bl-font)',
          background: dark ? 'radial-gradient(circle at 70% 18%, #2b2f4a, #0f1017 62%)' : 'radial-gradient(circle at 70% 18%, #fff4e6, #e8ecf3 62%)',
          color: dark ? '#f5f5f7' : '#1c1c1e', boxShadow: 'inset 0 0 0 1px var(--bl-sep)',
        }}
      >
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', opacity: 0.6 }}>HOST CONTENT</div>
          <p style={{ margin: '8px 0 0', maxWidth: 340, lineHeight: 1.5, opacity: 0.8, fontSize: 14 }}>{note}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 18 }}>
            {['#0A84FF', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF'].map((c) => (
              <div key={c} style={{ height: 64, borderRadius: 14, background: c, opacity: dark ? 0.75 : 0.6 }} />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function Rows({ n = 6 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ height: 56, borderRadius: 14, background: 'rgba(120,120,128,.14)' }} />
      ))}
    </>
  );
}

/* ── Detents ── */
const detentsCode = `import { FloatingSheet } from '@brett_lamy/ui'

// A half-height stop between resting and full. Release is velocity-aware: a flick
// goes to the next stop in its direction; a slow drag settles at the nearest one.
export default function Places() {
  return (
    <FloatingSheet peek={110} detents={[0.5]} appearance="sheet" label="Places">
      <FloatingSheet.Body>
        <PlaceList />
      </FloatingSheet.Body>
    </FloatingSheet>
  )
}`;

function DetentReadout() {
  const { open, progress } = useFloatingSheet();
  return (
    <div style={{ fontSize: 12.5, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
      {open ? 'Full' : progress > 0.05 ? 'Half detent' : 'Resting'} · {Math.round(progress * 100)}%
    </div>
  );
}

/* ── Appearance morph ── */
const appearanceCode = `import { FloatingSheet } from '@brett_lamy/ui'

// Changing appearance (or tone) morphs the same surface — background, border and shadow cross
// on the spring curves; nothing remounts.
export default function Sheet({ appearance }: { appearance: 'glass' | 'sheet' }) {
  return (
    <FloatingSheet appearance={appearance} peek={150} label="Order">
      <FloatingSheet.Body><OrderStatus /></FloatingSheet.Body>
    </FloatingSheet>
  )
}`;

/* ── Trays ── */
interface Tray {
  id: string;
  title: string;
  peek: number;
  body: ReactNode;
}
const STEPS = [{ id: 'placed', label: 'Placed' }, { id: 'preparing', label: 'Preparing' }, { id: 'ready', label: 'Ready' }];
const TRAYS: Tray[] = [
  {
    id: 'review', title: 'Review order', peek: 130,
    body: <div style={{ display: 'grid', gap: 8, fontSize: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>2× Flat white</span><strong>$9.00</strong></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>1× Almond croissant</span><strong>$4.75</strong></div></div>,
  },
  {
    id: 'pay', title: 'Pay with', peek: 250,
    body: <div style={{ display: 'grid', gap: 8 }}>{['Apple Pay', 'Visa ···· 4242', 'Add a card'].map((m, i) => <div key={m} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(120,120,128,.14)', fontSize: 14, fontWeight: i === 0 ? 700 : 500 }}>{m}</div>)}</div>,
  },
  {
    id: 'done', title: 'Order placed', peek: 110,
    body: <ProgressStepper steps={STEPS} current={1} labels />,
  },
];
const traysCode = `import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, FloatingSheet, springs } from '@brett_lamy/ui'

// One sheet, several trays. Each step sets its own peek, so the sheet's height morphs between them
// (a spring, not a jump), and the content slides the way the flow moves: forward from the right, back
// from the left.
export default function Checkout() {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next) }
  return (
    <FloatingSheet peek={trays[step].peek} appearance="sheet" minimizable={false} label="Checkout">
      <FloatingSheet.Body>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={step} custom={dir} variants={slide}
            initial="enter" animate="center" exit="exit" transition={springs.smooth}>
            {trays[step].body}
          </motion.div>
        </AnimatePresence>
      </FloatingSheet.Body>
      <FloatingSheet.Foot>
        <Button onPress={() => go(step - 1)} isDisabled={step === 0}>Back</Button>
        <Button onPress={() => go(Math.min(step + 1, trays.length - 1))}>Continue</Button>
      </FloatingSheet.Foot>
    </FloatingSheet>
  )
}`;
const slide = {
  enter: (dir: number) => ({ x: dir * 60, opacity: 0, filter: 'blur(3px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: dir * -60, opacity: 0, filter: 'blur(3px)' }),
};

export const FLOATING_SHEET_EXAMPLES: Record<string, LiveSpec> = {
  sheet_detents: {
    title: 'FloatingSheet · detents and velocity', theme: 'bl', h: 600,
    code: detentsCode,
    Render: function DetentsLive() {
      return (
        <Host note="Drag the cap slowly and let go — it settles at the nearest of resting, half and full. Flick it and it goes to the next stop the way you threw it, keeping your speed.">
          <FloatingSheet peek={110} detents={[0.5]} appearance="sheet" gutter={12} radius={24} label="Places" hideOnScroll={false}>
            <FloatingSheet.Body>
              <div style={{ padding: '2px 18px 24px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: 19 }}>Coffee nearby</h3>
                  <DetentReadout />
                </div>
                <Rows n={7} />
              </div>
            </FloatingSheet.Body>
          </FloatingSheet>
        </Host>
      );
    },
  },
  sheet_appearance: {
    title: 'FloatingSheet · glass ↔ card, morphing in place', theme: 'bl', h: 640,
    variants: [{ id: 'glass', label: 'Glass' }, { id: 'sheet', label: 'Card' }], variantsWidth: 180,
    code: appearanceCode,
    Render: function AppearanceLive({ variant }) {
      const appearance: FloatingSheetAppearance = variant === 'sheet' ? 'sheet' : 'glass';
      return (
        <Host note="Switch the appearance in the header: the same surface changes material — no remount, no jump.">
          <FloatingSheet appearance={appearance} peek={150} label="Order" hideOnScroll={false}>
            <FloatingSheet.Body>
              <div style={{ padding: '2px 20px 24px', display: 'grid', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 20 }}>Preparing your order</h3>
                <ProgressStepper current={1} labels steps={STEPS} />
                <Rows n={4} />
              </div>
            </FloatingSheet.Body>
            <FloatingSheet.Foot>
              <div style={{ padding: '8px 16px 16px' }}>
                <Button size="pill">Track order</Button>
              </div>
            </FloatingSheet.Foot>
          </FloatingSheet>
        </Host>
      );
    },
  },
  sheet_trays: {
    title: 'FloatingSheet · trays that change height', theme: 'bl', h: 620,
    code: traysCode,
    Render: function TraysLive() {
      const [step, setStep] = useState(0);
      const [dir, setDir] = useState(1);
      const go = (next: number) => {
        setDir(next > step ? 1 : -1);
        setStep(next);
      };
      const tray = TRAYS[step];
      return (
        <Host note="Continue and Back move through the trays: each has its own height, and the sheet morphs between them while the content slides the way the flow moves.">
          <FloatingSheet peek={tray.peek} appearance="sheet" minimizable={false} gutter={12} radius={26} label="Checkout" hideOnScroll={false}>
            <FloatingSheet.Body>
              <div style={{ padding: '2px 20px 20px', overflow: 'hidden' }}>
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div key={tray.id} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={springs.smooth}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 19 }}>{tray.title}</h3>
                    {tray.body}
                  </motion.div>
                </AnimatePresence>
              </div>
            </FloatingSheet.Body>
            <FloatingSheet.Foot>
              <div style={{ display: 'flex', gap: 8, padding: '8px 16px 16px' }}>
                <Button className="flex-1" variant="secondary" isDisabled={step === 0} onPress={() => go(step - 1)}>Back</Button>
                <Button className="flex-1" onPress={() => go(step === TRAYS.length - 1 ? 0 : step + 1)}>{step === TRAYS.length - 1 ? 'Start over' : 'Continue'}</Button>
              </div>
            </FloatingSheet.Foot>
          </FloatingSheet>
        </Host>
      );
    },
  },
};

