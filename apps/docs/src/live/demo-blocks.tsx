/* %%demo:<name>%% blocks — the big framed demos from the docs prototype shell. */
import { useMemo, useState } from 'react';
import {
  Avatar, HapticsPlayground, IndexBar, NavigationStack, SearchField, TabBar, TouchKitProvider,
  List as TKList, ListSection as TKSection, ListRow as TKRow,
  type Screen,
} from '@touchkit/ui';
import { WorkbenchDemo } from '@touchkit/workbench';
import { PencilKitDemo, demoStrokes } from '@touchkit/pencilkit';
import { TKL } from './frame';

const frame = (h: number, maxW?: number | string): React.CSSProperties => ({
  position: 'relative', height: h, maxWidth: maxW, border: '1px solid rgba(20,20,40,0.1)',
  borderRadius: 14, overflow: 'hidden', margin: '16px 0', boxShadow: '0 18px 44px -18px rgba(15,15,35,0.3)',
});

export function HapticsDemoBlock() {
  return (
    <div style={{
      background: '#F2F2F7', border: '1px solid rgba(20,20,40,0.07)', borderRadius: 16,
      padding: '10px 4px 14px', margin: '16px 0', ...TKL,
    } as any}>
      <HapticsPlayground />
    </div>
  );
}

export function WorkbenchDemoBlock() {
  return (
    <div style={frame(600)}>
      <div style={{ position: 'absolute', inset: 0 }}><WorkbenchDemo /></div>
    </div>
  );
}

export function PencilDemoBlock() {
  const strokes = useMemo(() => demoStrokes(), []);
  return (
    <div style={frame(540)}>
      <PencilKitDemo defaultStrokes={strokes} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

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
      <TKList>
        {letters.map((L) => (
          <div key={L} ref={(el) => { secRefs.current[L] = el; }}>
            <TKSection title={L} sticky>
              {byLetter[L].map((p, i) => (
                <TKRow key={p.f + p.l} leading={<Avatar c={p} size={36} />} title={p.f + ' ' + p.l}
                  subtitle={p.role} accessory="chevron" divider={i < byLetter[L].length - 1}
                  onPress={() => setSel(p)} />
              ))}
            </TKSection>
          </div>
        ))}
      </TKList>
    ),
  }];
  if (sel) screens.push({
    key: 'detail', title: sel.f + ' ' + sel.l, grouped: true, content: (
      <div style={{ padding: '26px 18px', textAlign: 'center' }}>
        <Avatar c={sel} size={76} style={{ margin: '0 auto' }} />
        <div style={{ fontSize: 21, fontWeight: 700, marginTop: 12 }}>{sel.f} {sel.l}</div>
        <div style={{ fontSize: 13.5, color: 'var(--tk-label2)', marginTop: 3 }}>{sel.role}</div>
        <div style={{ fontSize: 12.5, color: 'var(--tk-label2)', marginTop: 22, lineHeight: 1.5 }}>
          Edge-swipe from the left or use the back chevron to pop.
        </div>
      </div>
    ),
  });
  return (
    <div style={frame(560, 920)}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <TouchKitProvider>
          <div style={{ position: 'absolute', inset: 0 }}>
            {tab === 'contacts'
              ? <NavigationStack screens={screens} onPop={() => setSel(null)} />
              : <div style={{ position: 'absolute', inset: '0 0 62px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
                  <div>
                    <div style={{ fontSize: 16.5, fontWeight: 650 }}>{tab === 'recents' ? 'Recents' : 'Settings'}</div>
                    <div style={{ fontSize: 13, color: 'var(--tk-label2)', marginTop: 4 }}>Tab state survives switching away and back.</div>
                  </div>
                </div>}
            <TabBar selected={tab} onSelect={setTab} items={[
              { id: 'contacts', icon: 'person', title: 'Contacts' },
              { id: 'recents', icon: 'clock', title: 'Recents' },
              { id: 'settings', icon: 'sliders', title: 'Settings' },
            ]} />
          </div>
        </TouchKitProvider>
      </div>
    </div>
  );
}
