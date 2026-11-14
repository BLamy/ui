import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/lib/icon';
import { ListRow } from '@/components/ui/list';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { type ListRowAction } from '@/components/ui/list';
import { Pad } from '../stories/frame';
import { cn } from '@/lib/utils';

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
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'success', 'warning', 'destructive'] },
    align: { control: 'inline-radio', options: ['center', 'top'] },
    justify: { control: 'inline-radio', options: ['start', 'center'] },
    accessory: { control: 'inline-radio', options: [undefined, 'chevron', 'check'] },
  },
};

/** The anatomy: `icon`, `title`, `description`, `trailing`, then the `accessory`. */
export const Anatomy: Story = {
  render: () => (
    <ListRow
      title={<span>Wei <span style={{ fontWeight: 600 }}>Chen</span></span>}
      description="iOS Engineer · Parallel"
      icon={<Avatar name="Wei Chen" />}
      trailing={<Icon name="starF" size={13} className="text-warning" />}
      divider={false}
      onClick={() => undefined}
    />
  ),
};

export const AnatomyDark: Story = { ...Anatomy, parameters: { dark: true } };

function StateRows() {
  return (
    <>
      <ListRow title="Rest" description="Pressable, drills in" accessory="chevron" onClick={() => undefined} />
      <ListRow title="Current" description="The open item: a wash and aria-current" accessory="chevron" current onClick={() => undefined} />
      <ListRow title="Disabled" description="Can't be pressed or swiped" accessory="chevron" disabled onClick={() => undefined}
        trailingActions={[{ label: 'Delete', destructive: true, onAction: () => undefined }]} />
      <ListRow title="Checked" accessory="check" checked onClick={() => undefined} />
      <ListRow title="Connected" tone="success" trailing={<Icon name="check" size={15} sw={2.6} className="text-success" />} />
      <ListRow title="Sign Out" tone="destructive" justify="center" onClick={() => undefined} divider={false} />
    </>
  );
}

/** Rest, `current`, `disabled`, `checked`, `tone`, and a centered button row (`justify="center"`). */
export const States: Story = { render: () => <StateRows /> };
export const StatesDark: Story = { render: () => <StateRows />, parameters: { dark: true } };

export const Chevron: Story = {
  args: { title: 'Share Contact', accessory: 'chevron', onClick: () => undefined, divider: false },
};

export const Check: Story = {
  render: () => {
    const [v, setV] = useState('Reflection');
    return (
      <>
        {['Reflection', 'Chimes', 'Circuit'].map((r, i) => (
          <ListRow key={r} title={r} accessory="check" checked={v === r}
            onClick={() => setV(r)} divider={i < 2} />
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
          <ListRow key={f} title={f + ' ' + l} icon={<Avatar name={`${f} ${l}`} size={34} />}
            trailingActions={[{ label: 'Delete', destructive: true, onAction: () => setGone((g) => new Set([...g, f])) }]}
            onClick={() => undefined}
            divider={i < people.length - 1} />
        ))}
        <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted-foreground)', background: 'var(--card)' }}>
          Swipe a row left to reveal Delete; past 55% width it commits.
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
          <Switch checked={edit} onCheckedChange={setEdit} aria-label="Edit mode" />
        </div>
        {[['Amelia', 'Adler'], ['Wei', 'Chen'], ['Anya', 'Kowalski']].map(([f, l], i) => (
          <ListRow key={f} title={f + ' ' + l} icon={<Avatar name={`${f} ${l}`} size={34} />}
            editing={edit} checked={picked.has(f)}
            onClick={() => setPicked((p) => { const n = new Set(p); if (n.has(f)) n.delete(f); else n.add(f); return n; })}
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
  const toggle = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  return (
    <>
      {rows.map(([from, subject], i) => {
        const leading: ListRowAction[] = [
          { label: unread.has(from) ? 'Read' : 'Unread', icon: 'mail', tint: 'var(--primary)', onAction: () => setUnread((u) => toggle(u, from)) },
        ];
        const trailing: ListRowAction[] = [
          { label: 'Trash', icon: 'trash', destructive: true, onAction: () => setRows((r) => r.filter((x) => x[0] !== from)) },
          { label: flag.has(from) ? 'Unflag' : 'Flag', icon: 'starF', tint: 'var(--warning)', onAction: () => setFlag((f) => toggle(f, from)) },
          { label: 'More', icon: 'info', tint: 'var(--muted-foreground)', onAction: () => undefined },
        ];
        return (
          <ListRow key={from} title={<span style={{ fontWeight: unread.has(from) ? 600 : 400 }}>{from}</span>} description={subject}
            icon={<span aria-hidden style={{ width: 9, height: 9, borderRadius: 5, background: unread.has(from) ? 'var(--primary)' : 'transparent' }} />}
            trailing={flag.has(from) ? <Icon name="starF" size={13} className="text-warning" /> : null}
            leadingActions={leading} trailingActions={trailing}
            onClick={() => undefined} divider={i < rows.length - 1} />
        );
      })}
      <div style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted-foreground)', background: 'var(--card)' }}>
        Swipe right for Unread, left for Trash / Flag / More. A long swipe runs the outermost action (the
        threshold is 55% of the row width). Keyboard: focus a row, ← or → reveals its actions, Esc closes, Delete trashes.
      </div>
    </>
  );
}

/** `leadingActions` / `trailingActions`: index 0 is the outermost button, the one a full swipe triggers. */
export const SwipeActions: Story = { render: () => <MailRows /> };

/** The trailing actions revealed from the keyboard (focus the row, press ←). */
export const SwipeActionsRevealed: Story = {
  render: () => <MailRows />,
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-slot=list-row] [data-list-row-focus]');
    row?.focus();
    row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
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
      {/* No onClick: the row is a plain container. Pressing its label flips the switch. */}
      <ListRow title="Airplane Mode" accessory={<Switch checked={air} onCheckedChange={setAir} />} />
      <ListRow title="Wi-Fi" description={wifi ? 'Lamy Home' : 'Off'} accessory={<Switch checked={wifi} onCheckedChange={setWifi} />} />
      {/* A slider fills the row; its accessible name comes from the row title. */}
      <ListRow title="Volume" accessory={
        <Slider value={vol} onValueChange={(v) => setVol(v as number)} className="w-[150px]" />
      } />
      {/* onClick and a control side by side: the row button and the control are siblings, not nested. */}
      <ListRow title="Downloads" description={n ? `${n} queued` : 'Nothing queued'} onClick={() => undefined} divider={false}
        accessory={<Button size="sm" variant="secondary" onClick={() => setN((x) => x + 1)}>Get</Button>} />
    </>
  );
}

/** A Switch, Slider or Button in `accessory` (or `trailing`) never lands inside a <button>: without `onClick`
 *  the row renders a plain container, and with it the press target sits beneath the content. */
export const WithControls: Story = { render: () => <ControlRows /> };
export const WithControlsDark: Story = { render: () => <ControlRows />, parameters: { dark: true } };

/* ── Layouts: top-aligned leading, full-width controls, a wrapped Switch, a selected row ── */

/** A caller's own switch component — ListRow still names it after the row title (RowLabelContext). */
function SettingSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <span className="flex items-center"><Switch checked={on} onCheckedChange={onChange} /></span>;
}

function LayoutRows() {
  const [done, setDone] = useState(false);
  const [bright, setBright] = useState(40);
  const [shake, setShake] = useState(true);
  const [sel, setSel] = useState('inbox');
  return (
    <>
      {/* align="top": the icon sits on the first line of a wrapping title. */}
      <ListRow align="top" onClick={() => setDone((d) => !d)}
        icon={<span className={cn('box-border block size-[22px] rounded-full border-[1.6px]', done ? 'border-primary bg-primary' : 'border-tertiary-foreground')} />}
        title={<span className="block whitespace-normal">Book the cabin ferry for the long weekend, and check whether dogs ride free</span>}
        description="Friday, 9:00" />
      {/* children: a control that spans the row. */}
      <ListRow>
        <div className="flex items-center gap-2">
          <Icon name="sun" size={18} className="text-muted-foreground" />
          <Slider aria-label="Brightness" value={bright} onValueChange={(v) => setBright(v as number)} className="flex-1" />
          <Icon name="sun" size={24} className="text-muted-foreground" />
        </div>
      </ListRow>
      {/* A wrapped Switch is labelled by the title; contentClassName restyles the row surface. */}
      <ListRow title="Shake to Undo" contentClassName="min-h-[52px]" accessory={<SettingSwitch on={shake} onChange={setShake} />} />
      {/* current → a wash and aria-current on the row button. */}
      {['inbox', 'archive'].map((m, i) => (
        <ListRow key={m} title={m === 'inbox' ? 'Inbox' : 'Archive'} current={sel === m} onClick={() => setSel(m)} divider={i === 0} />
      ))}
    </>
  );
}

/** `align="top"`, full-width `children`, `contentClassName`, a wrapped Switch named by the row title, and
    `current` (aria-current). */
export const Layouts: Story = { render: () => <LayoutRows /> };
