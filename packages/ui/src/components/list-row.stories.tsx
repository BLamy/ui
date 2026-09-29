import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './avatar';
import { Icon } from '../lib/icon';
import { ListRow } from './list';
import { Switch } from './switch';
import { Slider } from './slider';
import { Button } from './button';
import { type ListRowAction } from './list';
import { Pad } from '../stories/frame';

const meta: Meta<typeof ListRow> = {
  title: 'Molecules/ListRow',
  component: ListRow,
  decorators: [(Story, ctx) => (
    <Pad w={390} dark={!!ctx.parameters.dark}>
      <div style={{ borderRadius: 12, overflow: 'hidden' }}><Story /></div>
    </Pad>
  )],
};
export default meta;
type Story = StoryObj<typeof ListRow>;

export const Basic: Story = {
  args: { title: 'Ringtone', divider: false },
};

export const SubtitleAndLeading: Story = {
  render: () => (
    <ListRow
      title={<span>Wei <span style={{ fontWeight: 600 }}>Chen</span></span>}
      subtitle="iOS Engineer · Parallel"
      leading={<Avatar c={{ f: 'Wei', l: 'Chen' }} />}
      trailing={<Icon name="starF" size={13} style={{ color: '#FF9F0A' }} />}
      divider={false}
      onPress={() => undefined}
    />
  ),
};

export const Chevron: Story = {
  args: { title: 'Share Contact', accessory: 'chevron', onPress: () => undefined, divider: false },
};

export const Check: Story = {
  render: () => {
    const [v, setV] = useState('Reflection');
    return (
      <>
        {['Reflection', 'Chimes', 'Circuit'].map((r, i) => (
          <ListRow key={r} title={r} accessory="check" checked={v === r} rowRole="option"
            onPress={() => setV(r)} divider={i < 2} />
        ))}
      </>
    );
  },
};

export const SwipeToDelete: Story = {
  render: () => {
    const [gone, setGone] = useState<Set<string>>(new Set());
    const people = [['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski']].filter(([f]) => !gone.has(f));
    return (
      <>
        {people.map(([f, l], i) => (
          <ListRow key={f} title={f + ' ' + l} leading={<Avatar c={{ f, l }} size={34} />}
            onDelete={() => setGone((g) => new Set([...g, f]))}
            onPress={() => undefined}
            divider={i < people.length - 1} />
        ))}
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted-foreground)', background: 'var(--card)' }}>
          Swipe a row left to reveal Delete; past 55% width it commits with a haptic.
        </div>
      </>
    );
  },
};

export const EditMode: Story = {
  render: () => {
    const [edit, setEdit] = useState(true);
    const [picked, setPicked] = useState<Set<string>>(new Set(['Wei']));
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px', background: 'var(--card)' }}>
          <Switch checked={edit} onChange={setEdit} aria-label="Edit mode" />
        </div>
        {[['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski']].map(([f, l], i) => (
          <ListRow key={f} title={f + ' ' + l} leading={<Avatar c={{ f, l }} size={34} />}
            edit={edit} checked={picked.has(f)}
            onPress={() => setPicked((p) => { const n = new Set(p); n.has(f) ? n.delete(f) : n.add(f); return n; })}
            divider={i < 2} />
        ))}
      </>
    );
  },
};

/* ── Swipe actions ── */

const MAIL: [string, string, string][] = [
  ['Northlake Studio', 'Mix notes for track 4', 'Amelia'],
  ['Parallel', 'Design review moved to 3pm', 'Wei'],
  ['Boulder Barn', 'New routes on the north wall', 'Anya'],
];

function MailRows() {
  const [rows, setRows] = useState(MAIL);
  const [unread, setUnread] = useState<Set<string>>(() => new Set(['Parallel']));
  const [flag, setFlag] = useState<Set<string>>(() => new Set());
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); return n; };
  return (
    <>
      {rows.map(([from, subject], i) => {
        const leading: ListRowAction[] = [
          { label: unread.has(from) ? 'Read' : 'Unread', icon: 'mail', tint: 'var(--primary)', onAction: () => setUnread((u) => toggle(u, from)) },
        ];
        const trailing: ListRowAction[] = [
          { label: 'Trash', icon: 'trash', destructive: true, onAction: () => setRows((r) => r.filter((x) => x[0] !== from)) },
          { label: flag.has(from) ? 'Unflag' : 'Flag', icon: 'starF', tint: '#FF9F0A', onAction: () => setFlag((f) => toggle(f, from)) },
          { label: 'More', icon: 'info', tint: '#8E8E93', onAction: () => undefined },
        ];
        return (
          <ListRow key={from} title={<span style={{ fontWeight: unread.has(from) ? 600 : 400 }}>{from}</span>} subtitle={subject}
            leading={<span aria-hidden style={{ width: 9, height: 9, borderRadius: 5, background: unread.has(from) ? 'var(--primary)' : 'transparent' }} />}
            trailing={flag.has(from) ? <Icon name="starF" size={13} style={{ color: '#FF9F0A' }} /> : null}
            leadingActions={leading} trailingActions={trailing}
            onPress={() => undefined} divider={i < rows.length - 1} />
        );
      })}
      <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted-foreground)', background: 'var(--card)' }}>
        Swipe right for Unread, left for Trash / Flag / More. A long swipe runs the outermost action (a tick marks
        the threshold). Keyboard: focus a row, → or ← reveals its actions, Esc closes, Delete trashes.
      </div>
    </>
  );
}

/** `leadingActions` / `trailingActions`: index 0 is the outermost button, the one a full swipe triggers. */
export const SwipeActions: Story = { render: () => <MailRows /> };

/** The trailing actions revealed from the keyboard (focus the row, press →). */
export const SwipeActionsRevealed: Story = {
  render: () => <MailRows />,
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-slot=list-row] [data-tkrow]');
    row?.focus();
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  },
};

export const SwipeActionsRevealedDark: Story = { ...SwipeActionsRevealed, parameters: { dark: true } };

/* ── Rows with controls ── */

function ControlRows() {
  const [wifi, setWifi] = useState(true);
  const [air, setAir] = useState(false);
  const [vol, setVol] = useState(60);
  const [n, setN] = useState(0);
  return (
    <>
      {/* No onPress: the row is a plain container. Pressing its label flips the switch. */}
      <ListRow title="Airplane Mode" accessory={<Switch checked={air} onChange={setAir} />} />
      <ListRow title="Wi-Fi" subtitle={wifi ? 'Lamy Home' : 'Off'} accessory={<Switch checked={wifi} onChange={setWifi} />} />
      {/* A slider fills the row; its accessible name comes from the row title. */}
      <ListRow title="Volume" accessory={
        <Slider value={vol} onChange={(v) => setVol(v as number)} className="w-[150px]" />
      } />
      {/* onPress and a control side by side: the row button and the control are siblings, not nested. */}
      <ListRow title="Downloads" subtitle={n ? `${n} queued` : 'Nothing queued'} onPress={() => undefined} divider={false}
        accessory={<Button size="sm" variant="secondary" onPress={() => setN((x) => x + 1)}>Get</Button>} />
    </>
  );
}

/** A Switch, Slider or Button in `accessory` (or `trailing`) never lands inside a <button>: without `onPress`
 *  the row renders a plain container, and with it the press target sits beneath the content. */
export const WithControls: Story = { render: () => <ControlRows /> };
export const WithControlsDark: Story = { render: () => <ControlRows />, parameters: { dark: true } };
