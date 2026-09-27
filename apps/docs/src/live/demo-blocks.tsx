/* %%demo:<name>%% blocks — the big framed demos from the docs prototype shell. */
import { useMemo, useState } from 'react';
import {
  Avatar, HapticsPlayground, IndexBar, NavigationStack, SearchField, TabBar, BLProvider, List, ListSection, ListRow,
  WorkbenchDemo, type Screen,
} from '@brett_lamy/ui';
import { PencilKitDemo, demoStrokes } from '@brett_lamy/pencilkit';
import { LiveCard, LiveStage } from './docs-live';

/* A fixed-height, full-bleed host for the big demos: the card supplies the border, so no nested frame. */
const stage = (h: number, maxW?: number | string): React.CSSProperties => ({
  position: 'relative', height: h, maxWidth: maxW, margin: maxW ? '0 auto' : undefined, overflow: 'hidden',
});

const HAPTICS_CODE = `import { Button, Haptics } from '@brett_lamy/ui'

// One engine, three calls: the same surface as UIFeedbackGenerator.
export default function Feedback() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onPress={() => Haptics.impact('light')}>Light</Button>
      <Button onPress={() => Haptics.impact('heavy')}>Heavy</Button>
      <Button onPress={() => Haptics.notification('success')}>Success</Button>
      <Button onPress={() => Haptics.selection()}>Selection</Button>
    </div>
  )
}`;

export function HapticsDemoBlock() {
  return (
    <LiveCard title="Haptics playground" code={HAPTICS_CODE}>
      <LiveStage><HapticsPlayground /></LiveStage>
    </LiveCard>
  );
}

const WORKBENCH_CODE = `import { WorkbenchDemo } from '@brett_lamy/ui'

// The full composition: threads, chat, terminal dock, and surface panel.
// Build your own from WorkbenchShell and its slots.
export default function App() {
  return (
    <div style={{ position: 'relative', height: 600 }}>
      <WorkbenchDemo />
    </div>
  )
}`;

export function WorkbenchDemoBlock() {
  return (
    <LiveCard title="Workbench" code={WORKBENCH_CODE}>
      <LiveStage theme="wb" bleed>
        <div style={stage(600)}><div style={{ position: 'absolute', inset: 0 }}><WorkbenchDemo /></div></div>
      </LiveStage>
    </LiveCard>
  );
}

const PENCIL_CODE = `import { PencilKitDemo, demoStrokes } from '@brett_lamy/pencilkit'

// Canvas, tool picker, inks, widths, undo/redo. Compose your own from
// PencilCanvas, PencilToolbar, and usePencilHistory.
export default function Sketch() {
  return (
    <div style={{ position: 'relative', height: 540 }}>
      <PencilKitDemo
        defaultStrokes={demoStrokes()}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}`;

export function PencilDemoBlock() {
  const strokes = useMemo(() => demoStrokes(), []);
  return (
    <LiveCard title="PencilKit" code={PENCIL_CODE}>
      <LiveStage bleed>
        <div style={stage(540)}>
          <PencilKitDemo defaultStrokes={strokes} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </LiveStage>
    </LiveCard>
  );
}

const APP_CODE = `import { useState } from 'react'
import {
  Avatar, BLProvider, List, ListRow, ListSection, NavigationStack, TabBar,
  type Screen,
} from '@brett_lamy/ui'

const people = [
  { f: 'Ada', l: 'Lovelace', role: 'Analytical engines' },
  { f: 'Bea', l: 'Okafor', role: 'Haptics research' },
]

export default function Contacts() {
  const [tab, setTab] = useState('contacts')
  const [person, setPerson] = useState<(typeof people)[number] | null>(null)
  const screens: Screen[] = [{
    key: 'list',
    title: 'Contacts',
    largeTitle: true,
    grouped: true,
    bottomInset: 62,
    content: (
      <List>
        <ListSection title="People" sticky>
          {people.map((p) => (
            <ListRow
              key={p.l}
              leading={<Avatar c={p} size={36} />}
              title={\`\${p.f} \${p.l}\`}
              subtitle={p.role}
              accessory="chevron"
              onPress={() => setPerson(p)}
            />
          ))}
        </ListSection>
      </List>
    ),
  }]
  if (person) {
    screens.push({ key: 'detail', title: person.f, content: <p>{person.role}</p> })
  }
  return (
    <div style={{ position: 'relative', height: 560 }}>
      <BLProvider>
        <NavigationStack screens={screens} onPop={() => setPerson(null)} />
        <TabBar selected={tab} onSelect={setTab} items={[
          { id: 'contacts', icon: 'person', title: 'Contacts' },
          { id: 'recents', icon: 'clock', title: 'Recents' },
        ]} />
      </BLProvider>
    </div>
  )
}`;

/* Compact recreation of the Contacts demo app for the introduction page — demo composition
   lives in the app per the conventions (packages export primitives only). */
const PEOPLE: Array<{ f: string; l: string; role: string }> = [
  { f: 'Ada', l: 'Lovelace', role: 'Analytical engines' },
  { f: 'Avi', l: 'Chen', role: 'Sound design' },
  { f: 'Bea', l: 'Okafor', role: 'Haptics research' },
  { f: 'Ben', l: 'Alvarez', role: 'Motion' },
  { f: 'Cal', l: 'Nguyen', role: 'Type systems' },
  { f: 'Dot', l: 'Kim', role: 'Interaction physics' },
  { f: 'Eli', l: 'Sato', role: 'Springs' },
  { f: 'Eva', l: 'Marsh', role: 'Color science' },
  { f: 'Fay', l: 'Ito', role: 'Gestures' },
  { f: 'Gus', l: 'Holt', role: 'Accessibility' },
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Zoe', l: 'Park', role: 'Prototyping' },
];

export function AppDemoBlock() {
  const [tab, setTab] = useState('contacts');
  const [sel, setSel] = useState<(typeof PEOPLE)[number] | null>(null);
  const [q, setQ] = useState('');
  const secRefs = useMemo(() => ({ current: {} as Record<string, HTMLDivElement | null> }), []);
  const people = PEOPLE.filter((p) => (p.f + ' ' + p.l).toLowerCase().includes(q.toLowerCase()));
  const byLetter: Record<string, typeof PEOPLE> = {};
  people.forEach((p) => { (byLetter[p.f[0]] = byLetter[p.f[0]] || []).push(p); });
  const letters = Object.keys(byLetter).sort();
  const screens: Screen[] = [{
    key: 'list', title: 'Contacts', largeTitle: true, grouped: true, bottomInset: 62,
    subheader: <div style={{ padding: '0 14px 8px' }}><SearchField q={q} setQ={setQ} placeholder="Search" /></div>,
    overlay: <IndexBar avail={new Set(letters)} top={118} bottom={70}
      onLetter={(L) => { const el = secRefs.current[L]; el?.scrollIntoView({ block: 'start' }); }} />,
    content: (
      <List>
        {letters.map((L) => (
          <div key={L} ref={(el) => { secRefs.current[L] = el; }}>
            <ListSection title={L} sticky>
              {byLetter[L].map((p, i) => (
                <ListRow key={p.f + p.l} leading={<Avatar c={p} size={36} />} title={p.f + ' ' + p.l}
                  subtitle={p.role} accessory="chevron" divider={i < byLetter[L].length - 1}
                  onPress={() => setSel(p)} />
              ))}
            </ListSection>
          </div>
        ))}
      </List>
    ),
  }];
  if (sel) screens.push({
    key: 'detail', title: sel.f + ' ' + sel.l, grouped: true, content: (
      <div style={{ padding: '26px 18px', textAlign: 'center' }}>
        <Avatar c={sel} size={76} style={{ margin: '0 auto' }} />
        <div style={{ fontSize: 21, fontWeight: 700, marginTop: 12 }}>{sel.f} {sel.l}</div>
        <div style={{ fontSize: 13.5, color: 'var(--bl-label2)', marginTop: 3 }}>{sel.role}</div>
        <div style={{ fontSize: 12.5, color: 'var(--bl-label2)', marginTop: 22, lineHeight: 1.5 }}>
          Edge-swipe from the left or use the back chevron to pop.
        </div>
      </div>
    ),
  });
  return (
    <LiveCard title="Contacts" code={APP_CODE}>
    <LiveStage bleed>
    <div style={stage(560)}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <BLProvider>
          <div style={{ position: 'absolute', inset: 0 }}>
            {tab === 'contacts'
              ? <NavigationStack screens={screens} onPop={() => setSel(null)} />
              : <div style={{ position: 'absolute', inset: '0 0 62px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
                  <div>
                    <div style={{ fontSize: 16.5, fontWeight: 650 }}>{tab === 'recents' ? 'Recents' : 'Settings'}</div>
                    <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 4 }}>Tab state survives switching away and back.</div>
                  </div>
                </div>}
            <TabBar selected={tab} onSelect={setTab} items={[
              { id: 'contacts', icon: 'person', title: 'Contacts' },
              { id: 'recents', icon: 'clock', title: 'Recents' },
              { id: 'settings', icon: 'sliders', title: 'Settings' },
            ]} />
          </div>
        </BLProvider>
      </div>
    </div>
    </LiveStage>
    </LiveCard>
  );
}
