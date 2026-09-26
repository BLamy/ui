/* Live examples for the Motion page (GETTING STARTED → Motion). Each `code` is a copy-pasteable sample against
   @brett_lamy/ui; each Render is the same thing running. */
import { useState, type CSSProperties } from 'react';
import {
  AnimatedHeight, Button, Celebrate, ContentSwap, Haptics, Icon, IconSwap, NumberMorph, Spinner, Tab, TabList, TabPanel, Tabs,
  TextMorph, springCss, useDirection, type SpringName,
} from '@brett_lamy/ui';
import { BLFrame, type LiveSpec } from '../frame';

const center: CSSProperties = { display: 'grid', placeItems: 'center', gap: 14, justifyItems: 'center' };
const note: CSSProperties = { fontSize: 12.5, color: 'var(--bl-label2)', textAlign: 'center', lineHeight: 1.5 };

/* ── 1. Text morph: Continue → Confirm ── */
const textMorphCode = `import { useState } from 'react'
import { Button } from '@brett_lamy/ui'

// A string child morphs on change: shared letters (C, o, n, i) slide into place,
// the rest blur out and in, and the button springs to its new width.
export default function SendButton() {
  const [ready, setReady] = useState(false)
  return (
    <Button size="lg" onPress={() => setReady((r) => !r)}>
      {ready ? 'Confirm' : 'Continue'}
    </Button>
  )
}

// Any text, outside a button too:
// <TextMorph>{status}</TextMorph>`;

function TextMorphLive() {
  const [ready, setReady] = useState(false);
  return (
    <div style={center}>
      <Button size="lg" onPress={() => { setReady((r) => !r); Haptics.impact('light'); }}>{ready ? 'Confirm' : 'Continue'}</Button>
      <div style={{ fontSize: 26, fontWeight: 750, letterSpacing: -0.4 }}><TextMorph>{ready ? 'Review and confirm' : 'Review and continue'}</TextMorph></div>
      <div style={note}>Press the button. Letters the two words share stay and slide; the rest cross through a blur.</div>
    </div>
  );
}

/* ── 2. Amount entry with sliding commas ── */
const numberCode = `import { useState } from 'react'
import { Button, NumberMorph } from '@brett_lamy/ui'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫']

export default function Amount() {
  const [cents, setCents] = useState(123456)
  const press = (k: string) => setCents((c) =>
    k === '⌫' ? Math.floor(c / 10) : Math.min(c * (k === '00' ? 100 : 10) + (k === '00' ? 0 : +k), 99_999_999_99))
  return (
    <>
      {/* Digits keep their place: typing slides the comma one digit left; changed digits roll. */}
      <NumberMorph value={cents / 100} format={{ style: 'currency', currency: 'USD' }}
        className="text-[44px] font-bold" />
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => <Button key={k} variant="secondary" onPress={() => press(k)}>{k}</Button>)}
      </div>
    </>
  )
}`;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

function NumberLive() {
  const [cents, setCents] = useState(123456);
  const max = 9_999_999_999;
  const press = (k: string) => {
    Haptics.selection();
    setCents((c) => {
      const next = k === '⌫' ? Math.floor(c / 10) : c * (k === '00' ? 100 : 10) + (k === '00' ? 0 : Number(k));
      if (next > max) { Haptics.notification('warning'); return c; }
      return next;
    });
  };
  return (
    <div style={center}>
      <div style={{ fontSize: 44, fontWeight: 750, letterSpacing: -1, lineHeight: 1.15 }}>
        <NumberMorph value={cents / 100} format={{ style: 'currency', currency: 'USD' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 76px)', gap: 8 }}>
        {KEYS.map((k) => (
          <Button key={k} variant="secondary" size="lg" aria-label={k === '⌫' ? 'Delete' : k} onPress={() => press(k)}>
            {k === '⌫' ? <Icon name="chevL" size={20} sw={2.4} /> : k}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ── 3. Directional tabs ── */
const tabsCode = (variant: string) => `import { Tab, TabList, TabPanel, Tabs } from '@brett_lamy/ui'

// The selected ${variant === 'underline' ? 'underline' : 'card'} slides to the new tab; the panel arrives from the side
// of the tab you picked (a tab to the left → content comes in from the left).
export default function Wallet() {
  return (
    <Tabs variant="${variant}" defaultSelectedKey="tokens">
      <TabList aria-label="Wallet">
        <Tab id="tokens">Tokens</Tab>
        <Tab id="collectibles">Collectibles</Tab>
        <Tab id="activity">Activity</Tab>
      </TabList>
      <TabPanel id="tokens"><Tokens /></TabPanel>
      <TabPanel id="collectibles"><Collectibles /></TabPanel>
      <TabPanel id="activity"><Activity /></TabPanel>
    </Tabs>
  )
}`;

const TABS = [
  { id: 'tokens', title: 'Tokens', rows: [['ETH', '$2,480.00'], ['USDC', '$1,120.50'], ['OP', '$96.12']] },
  { id: 'collectibles', title: 'Collectibles', rows: [['Sequin #214', '0.42 ETH'], ['Tumble #9', '0.08 ETH']] },
  { id: 'activity', title: 'Activity', rows: [['Sent to Wei', '−$120.00'], ['Received', '+$48.10'], ['Swapped', 'ETH → USDC'], ['Backed up', 'Today']] },
];

function TabsLive({ variant }: { variant: string }) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <Tabs key={variant} variant={variant as 'segmented' | 'underline'} defaultSelectedKey="tokens">
        <TabList aria-label="Wallet">
          {TABS.map((t) => <Tab key={t.id} id={t.id}>{t.title}</Tab>)}
        </TabList>
        {TABS.map((t) => (
          <TabPanel key={t.id} id={t.id}>
            <div style={{ background: 'var(--bl-card)', borderRadius: 14, overflow: 'hidden' }}>
              {t.rows.map(([a, b], i) => (
                <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', fontSize: 15, boxShadow: i ? 'inset 0 1px 0 var(--bl-sep)' : undefined }}>
                  <span>{a}</span><span style={{ color: 'var(--bl-label2)' }}>{b}</span>
                </div>
              ))}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}

/* ── 4. A tray whose height morphs across steps ── */
const trayCode = `import { useState } from 'react'
import { AnimatedHeight, Button, ContentSwap, useDirection } from '@brett_lamy/ui'

// Each step is a different height. AnimatedHeight springs the tray to fit; ContentSwap moves the
// step in the direction of travel; the button's label morphs (Continue → Confirm).
export default function SendTray() {
  const [step, setStep] = useState(0)
  const dir = useDirection(step)
  return (
    <div className="rounded-[28px] bg-card shadow-lg">
      <AnimatedHeight>
        <ContentSwap id={step} direction={dir}>{STEPS[step]}</ContentSwap>
      </AnimatedHeight>
      <div className="flex gap-2 p-4">
        {step > 0 && <Button variant="secondary" onPress={() => setStep(step - 1)}>Back</Button>}
        <Button className="flex-1" onPress={() => setStep((step + 1) % STEPS.length)}>
          {step === STEPS.length - 1 ? 'Confirm' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}`;

function Step({ step }: { step: number }) {
  if (step === 0) return (
    <div style={{ padding: '18px 18px 4px' }}>
      <div style={{ fontSize: 19, fontWeight: 750 }}>Send</div>
      <div style={{ fontSize: 14, color: 'var(--bl-label2)', marginTop: 4 }}>To Wei Chen</div>
    </div>
  );
  if (step === 1) return (
    <div style={{ padding: '18px 18px 4px' }}>
      <div style={{ fontSize: 19, fontWeight: 750 }}>Amount</div>
      <div style={{ fontSize: 40, fontWeight: 750, letterSpacing: -1, margin: '8px 0 2px' }}>$120.00</div>
      <div style={{ fontSize: 13, color: 'var(--bl-label2)' }}>Balance $2,480.00</div>
    </div>
  );
  return (
    <div style={{ padding: '18px 18px 4px' }}>
      <div style={{ fontSize: 19, fontWeight: 750 }}>Review</div>
      {[['To', 'Wei Chen'], ['Amount', '$120.00'], ['Network fee', '$0.12'], ['Arrives', 'About a minute']].map(([a, b], i) => (
        <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 15, boxShadow: i ? 'inset 0 1px 0 var(--bl-sep)' : undefined }}>
          <span style={{ color: 'var(--bl-label2)' }}>{a}</span><span>{b}</span>
        </div>
      ))}
    </div>
  );
}

function TrayLive() {
  const [step, setStep] = useState(0);
  const dir = useDirection(step);
  const last = step === 2;
  return (
    <BLFrame h={380}>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, maxWidth: 380, margin: '0 auto' }}
        className="rounded-[28px] bg-card shadow-[0_24px_80px_rgba(0,0,0,.18),0_0_0_1px_var(--bl-sep)]">
        <AnimatedHeight>
          <ContentSwap id={step} direction={dir}><Step step={step} /></ContentSwap>
        </AnimatedHeight>
        <div style={{ display: 'flex', gap: 8, padding: 16 }}>
          <Button variant="secondary" size="lg" aria-label="Back" isDisabled={step === 0} onPress={() => setStep(step - 1)}>
            <Icon name="chevL" size={18} sw={2.6} />
          </Button>
          <Button size="lg" className="flex-1" onPress={() => { Haptics.impact(last ? 'medium' : 'light'); setStep(last ? 0 : step + 1); }}>
            {last ? 'Confirm' : 'Continue'}
          </Button>
        </div>
      </div>
    </BLFrame>
  );
}

/* ── 5. A rare moment ── */
const celebrateCode = `import { useState } from 'react'
import { Button, Celebrate, Haptics, Icon, IconSwap, Spinner, TextMorph } from '@brett_lamy/ui'

// Rare moments may celebrate: the backup finishing is worth a burst. Tab switches are not.
export default function Backup() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [fired, setFired] = useState(0)
  const run = () => {
    setState('busy')
    setTimeout(() => { setState('done'); setFired((n) => n + 1); Haptics.notification('success') }, 1400)
  }
  return (
    <span className="relative isolate">
      <Button size="lg" onPress={state === 'done' ? () => setState('idle') : run} isDisabled={state === 'busy'}>
        <IconSwap id={state}>
          {state === 'busy' ? <Spinner spin size={18} /> : <Icon name={state === 'done' ? 'check' : 'layers'} size={18} />}
        </IconSwap>
        {/* A string sibling won't morph on its own — wrap it: */}
        <TextMorph>{state === 'busy' ? 'Backing up…' : state === 'done' ? 'Backed up' : 'Back up wallet'}</TextMorph>
      </Button>
      <Celebrate fire={fired} />
    </span>
  )
}`;

function CelebrateLive() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [fired, setFired] = useState(0);
  const run = () => {
    setState('busy');
    setTimeout(() => { setState('done'); setFired((n) => n + 1); Haptics.notification('success'); }, 1400);
  };
  return (
    <div style={{ ...center, padding: '34px 0' }}>
      <span style={{ position: 'relative', isolation: 'isolate' }}>
        <Button size="lg" onPress={state === 'done' ? () => setState('idle') : run} isDisabled={state === 'busy'}
          className={state === 'done' ? 'bg-success' : undefined}>
          <IconSwap id={state}>
            {state === 'busy' ? <Spinner spin size={18} /> : <Icon name={state === 'done' ? 'check' : 'layers'} size={18} sw={2.4} />}
          </IconSwap>
          <TextMorph>{state === 'busy' ? 'Backing up…' : state === 'done' ? 'Backed up' : 'Back up wallet'}</TextMorph>
        </Button>
        <Celebrate fire={fired} />
      </span>
      <div style={note}>{state === 'done' ? 'Press again to reset.' : 'Runs a pretend backup, then celebrates once.'}</div>
    </div>
  );
}

/* ── 6. The spring presets side by side ── */
const springsCode = `import { motion } from 'framer-motion'
import { springs, springCss } from '@brett_lamy/ui'

// framer-motion: pass a preset as the transition.
<motion.div animate={{ x: on ? 220 : 0 }} transition={springs.smooth} />

// CSS / Tailwind: the same physics sampled into linear() easings.
<div className="transition-transform duration-spring-smooth ease-spring-smooth" />
<div style={{ transition: springCss('transform', 'smooth') }} />`;

const PRESETS: { id: SpringName; use: string }[] = [
  { id: 'snappy', use: 'small controls, presses, indicators' },
  { id: 'smooth', use: 'layout, panels, navigation' },
  { id: 'tray', use: 'sheets, trays, height morphs' },
  { id: 'bouncy', use: 'rare, celebratory moments' },
];

function SpringsLive() {
  const [on, setOn] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 440, margin: '0 auto' }}>
      {PRESETS.map((p) => (
        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', gap: 10 }}>
          <code style={{ fontSize: 12.5, fontWeight: 600 }}>{p.id}</code>
          <div style={{ position: 'relative', height: 30, borderRadius: 15, background: 'var(--bl-fill)' }}>
            <span style={{
              position: 'absolute', top: 3, left: on ? 'calc(100% - 27px)' : 3, width: 24, height: 24, borderRadius: 12,
              background: 'var(--bl-tint)', transition: springCss('left', p.id),
            }} />
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <Button variant="secondary" onPress={() => setOn((v) => !v)}>{on ? 'Back' : 'Go'}</Button>
      </div>
      <div style={note}>Press repeatedly mid-flight — springs retarget from wherever they are.</div>
    </div>
  );
}

export const MOTION_LIVE: Record<string, LiveSpec> = {
  motiontext: { title: 'TextMorph · Continue → Confirm', theme: 'bl', h: 200, code: textMorphCode, Render: TextMorphLive },
  motionnumber: { title: 'NumberMorph · amount entry', theme: 'bl', h: 360, code: numberCode, Render: NumberLive },
  motiontabs: {
    title: 'Tabs · directional panels', theme: 'bl', h: 260, code: tabsCode('segmented'), codeFor: tabsCode,
    variants: [{ id: 'segmented', label: 'Segmented' }, { id: 'underline', label: 'Underline' }], variantsWidth: 220,
    Render: TabsLive,
  },
  motiontray: { title: 'AnimatedHeight · a tray across steps', theme: 'bl', h: 380, code: trayCode, Render: TrayLive },
  motioncelebrate: { title: 'Celebrate · a rare moment', theme: 'bl', h: 200, code: celebrateCode, Render: CelebrateLive },
  motionsprings: { title: 'springs · the four presets', theme: 'bl', h: 240, code: springsCode, Render: SpringsLive },
};
