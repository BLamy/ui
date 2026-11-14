import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IndexBar, alphabetItems } from '@/components/ui/index-bar';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { Phone } from '../stories/frame';

const meta: Meta<{ dark?: boolean }> = {
  title: 'Molecules/IndexBar',
  args: { dark: false },
  decorators: [(Story, { args }) => <Phone w={390} h={560} dark={args.dark}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<{ dark?: boolean }>;

function AlphaExample() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {last ? 'Jumped to ' + last : 'Drag the rail →'}
      </div>
      <IndexBar items={alphabetItems(['A', 'B', 'C', 'H', 'K', 'S', 'W', 'Z'])} onJump={setLast} className="top-3 bottom-3" />
    </>
  );
}

export const AlphaAZ: Story = {
  render: () => <AlphaExample />,
};

function CustomItemsExample() {
  const [last, setLast] = useState<string | null>(null);
  const items = [
    { key: 'm1', label: '', caption: 'Question', preview: 'Why is the build slow on CI but not locally?' },
    { key: 'm2', label: '', caption: 'Decision', preview: 'We will ship the new rail behind a flag.' },
    { key: 'm3', label: '●', caption: 'Pinned', preview: 'Design review moved to Thursday 2pm.' },
    { key: 'm4', label: '', preview: 'Can someone rerun the flaky index-bar test?' },
    { key: 'm5', label: '', disabled: true, preview: 'Archived: old branch cleanup thread.' },
  ];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {last ? 'Jumped to ' + last : 'Hover, drag, or use arrow keys →'}
      </div>
      <IndexBar items={items} onJump={(key) => setLast(key)} className="top-10 bottom-10" aria-label="Jump to conversation event" />
    </>
  );
}

export const CustomItemsWithPreviews: Story = {
  render: () => <CustomItemsExample />,
};

const THREAD = [
  ['Flaky CI on the index-bar test', 'Why does the index-bar test only fail on CI and never on my machine?'],
  ['Pointer capture', 'Capturing the pointer starves the window of move events during a scrub.'],
  ['Window listeners for scrubbing', 'Track the drag with window listeners instead, and clean them up on pointercancel.'],
  ['Highlight per stop', 'Only update when the stop actually changes, otherwise a slow drag flickers constantly.'],
  ['Reduced motion', 'Keep the active state visible but drop the width transitions when motion is reduced.'],
  ['Rail spacing', 'Ten pixels per stop reads as a calm column of dashes, even with forty turns.'],
  ['Dock-style falloff', 'A raised cosine over three stops feels closer to the Dock than a gaussian did.'],
  ['Preview card sizing', 'Cap the card at 260px and clamp the preview to two lines so it never covers the thread.'],
  ['Left or right rail', 'Chat threads want the rail on the left; contact lists keep the classic right edge.'],
  ['Keyboard access', 'Arrow keys move one stop, Home and End jump to the ends, and each one commits.'],
  ['Current turn marker', 'Pass current to paint the turn in view in the tint, full length, at rest.'],
  ['Dark mode surface', 'The card uses bg-card with the separator ring, so it holds up on both themes.'],
  ['Touch scrubbing', 'On touch the swell follows the finger while it scrubs, and the card rides along.'],
  ['Docs live example', 'Add a third Wave option next to Custom stops and the A–Z fallback.'],
  ['Visual regression', 'Default IndexBar stories must stay pixel-identical after the refactor.'],
  ['Storybook stories', 'Twenty turns is enough to show the wave without crowding the frame.'],
  ['Release notes', 'Mention the new variant, side, and current props in the lists page table.'],
  ['Naming the variant', 'Wave says what it does; magnify sounded like a zoom control.'],
  ['Follow-ups', 'Maybe animate the card between stops with a spring instead of a tween.'],
  ['Wrap-up', 'Ship it behind nothing — the default rendering is unchanged.'],
] as const;

const waveStops = THREAD.map(([caption, preview], i) => ({ key: `t${i + 1}`, caption, preview }));

function WaveExample({ side, panel }: { side: 'start' | 'end'; panel?: boolean }) {
  const [current, setCurrent] = useState('t6');
  const title = waveStops.find((s) => s.key === current)?.caption;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 60, textAlign: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {title}
      </div>
      <IndexBar variant="wave" side={side} items={waveStops} current={current} onJump={(key) => setCurrent(key)}
        panel={panel} panelTitle={panel ? 'Thread' : undefined} className="top-3 bottom-3" aria-label="Jump to a turn" />
    </>
  );
}

export const Wave: Story = {
  render: () => <WaveExample side="end" />,
};

export const WaveStart: Story = {
  render: () => <WaveExample side="start" />,
};

export const WaveDark: Story = {
  args: { dark: true },
  render: () => <WaveExample side="start" />,
};

/** `panel`: hovering or focusing the rail opens the outline card (synthesized hover). */
export const WavePanel: Story = {
  render: () => <WaveExample side="start" panel />,
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector<HTMLElement>('[data-slot=index-bar]');
    if (!rail) return;
    const r = rail.getBoundingClientRect();
    const init = { bubbles: true, pointerType: 'mouse', clientX: r.left + 10, clientY: r.top + r.height / 2 };
    rail.dispatchEvent(new PointerEvent('pointerover', init));
    rail.dispatchEvent(new PointerEvent('pointerenter', init));
    rail.dispatchEvent(new PointerEvent('pointermove', init));
  },
};

/** Hovered state captured statically: a mouse hover is synthesized over the 9th stop. */
export const WaveHovered: Story = {
  render: () => <WaveExample side="start" />,
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector<HTMLElement>('[data-slot=index-bar]');
    const stop = rail?.querySelectorAll<HTMLElement>('[role=option]')[8];
    if (!rail || !stop) return;
    const r = stop.getBoundingClientRect();
    const init = { bubbles: true, pointerType: 'mouse', clientX: r.left + 10, clientY: r.top + r.height * 0.7 };
    rail.dispatchEvent(new PointerEvent('pointerover', init));
    rail.dispatchEvent(new PointerEvent('pointermove', init));
  },
};

/* ── A–Z beside a list: rows widen their trailing inset to clear the rail ── */

const PEOPLE = ['Ada Lovelace', 'Alan Turing', 'Barbara Liskov', 'Brian Kernighan', 'Claude Shannon', 'Donald Knuth', 'Edsger Dijkstra',
  'Frances Allen', 'Grace Hopper', 'Hedy Lamarr', 'Ken Thompson', 'Linus Torvalds', 'Margaret Hamilton', 'Radia Perlman', 'Tim Berners-Lee'];

function ListExample() {
  const groups = PEOPLE.reduce<Record<string, string[]>>((acc, name) => {
    const letter = name.split(' ').pop()![0];
    (acc[letter] ??= []).push(name);
    return acc;
  }, {});
  const letters = Object.keys(groups).sort();
  return (
    <>
      <div className="absolute inset-0 overflow-y-auto">
        <List>
          {letters.map((letter) => (
            <ListSection key={letter} title={letter} sticky>
              {groups[letter].map((name) => <ListRow key={name} title={name} accessory="chevron" onClick={() => {}} />)}
            </ListSection>
          ))}
        </List>
      </div>
      <IndexBar items={alphabetItems(letters)} className="top-3 bottom-3" />
    </>
  );
}

/** The A–Z rail over a plain list: chevrons stay clear of the letters (`--bl-index-bar-inset`). */
export const BesideList: Story = { render: () => <ListExample /> };
export const BesideListDark: Story = { args: { dark: true }, render: () => <ListExample /> };
