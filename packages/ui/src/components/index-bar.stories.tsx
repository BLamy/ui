import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IndexBar } from '@/components/ui/index-bar';
import { Phone } from '../stories/frame';

const meta: Meta<typeof IndexBar> = {
  title: 'Molecules/IndexBar',
  component: IndexBar,
  decorators: [(Story) => <Phone w={390} h={560}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof IndexBar>;

function AlphaExample() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {last ? 'Jumped to ' + last : 'Drag the rail →'}
      </div>
      <IndexBar avail={new Set(['A', 'B', 'C', 'H', 'K', 'S', 'W', 'Z'])} onLetter={setLast} top={12} bottom={12} />
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
    { key: 'm5', label: '', dim: true, preview: 'Archived: old branch cleanup thread.' },
  ];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {last ? 'Jumped to ' + last : 'Hover, drag, or use arrow keys →'}
      </div>
      <IndexBar items={items} onJump={(key) => setLast(key)} top={40} bottom={40} label="Jump to conversation event" />
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
  ['Current turn marker', 'Pass value to paint the turn in view in the tint, full length, at rest.'],
  ['Dark mode surface', 'The card uses bg-card with the separator ring, so it holds up on both themes.'],
  ['Touch scrubbing', 'On touch the swell follows the finger while it scrubs, and the card rides along.'],
  ['Docs live example', 'Add a third Wave option next to Custom stops and the A–Z fallback.'],
  ['Visual regression', 'Default IndexBar stories must stay pixel-identical after the refactor.'],
  ['Storybook stories', 'Twenty turns is enough to show the wave without crowding the frame.'],
  ['Release notes', 'Mention the new variant, side, and value props in the lists page table.'],
  ['Naming the variant', 'Wave says what it does; magnify sounded like a zoom control.'],
  ['Follow-ups', 'Maybe animate the card between stops with a spring instead of a tween.'],
  ['Wrap-up', 'Ship it behind nothing — the default rendering is unchanged.'],
] as const;

const waveStops = THREAD.map(([caption, preview], i) => ({ key: `t${i + 1}`, caption, preview }));

function WaveExample({ side }: { side: 'left' | 'right' }) {
  const [current, setCurrent] = useState('t6');
  const title = waveStops.find((s) => s.key === current)?.caption;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 60, textAlign: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
        {title}
      </div>
      <IndexBar variant="wave" side={side} items={waveStops} value={current} onJump={(key) => setCurrent(key)}
        top={12} bottom={12} label="Jump to a turn" />
    </>
  );
}

export const Wave: Story = {
  render: () => <WaveExample side="right" />,
};

export const WaveLeft: Story = {
  render: () => <WaveExample side="left" />,
};

/** Hovered state captured statically: a mouse hover is synthesized over the 9th stop. */
export const WaveHovered: Story = {
  render: () => <WaveExample side="left" />,
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
