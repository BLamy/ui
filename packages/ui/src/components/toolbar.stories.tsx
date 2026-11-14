import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { Toggle } from '@/components/ui/toggle';
import {
  Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator, ToolbarText, type ToolbarSize, type ToolbarVariant,
} from '@/components/ui/toolbar';
import { Icon } from '@/lib/icon';
import { Phone } from '../stories/frame';
import { Panel } from '../stories/primitive-frame';

interface Args { variant: ToolbarVariant; size: ToolbarSize; dark?: boolean; disabled?: boolean }
const meta: Meta<Args> = {
  title: 'Molecules/Toolbar',
  args: { variant: 'plain', size: 'default', dark: false, disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'floating', 'bar'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<Args>;

/* ── An editor's toolbar: buttons, a toggle group, a separator, a text readout ── */

function Formatting({ variant, size, disabled }: Omit<Args, 'dark'>) {
  const icon = size === 'sm' ? 'icon-sm' : size === 'lg' ? 'icon-lg' : 'icon';
  return (
    <Toolbar variant={variant} size={size} disabled={disabled} aria-label="Formatting">
      <ToolbarGroup aria-label="History">
        <ToolbarButton>Undo</ToolbarButton>
        <ToolbarButton disabled>Redo</ToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator />
      <Toggle variant="quiet" size={icon} className={icon === 'icon-sm' ? undefined : icon === 'icon' ? 'rounded-ctl' : 'rounded-xl'} aria-label="Favorite"><Icon name="star" size={16} /></Toggle>
      <ToolbarButton size={icon} aria-label="Insert link"><Icon name="link" size={16} /></ToolbarButton>
      <ToolbarButton size={icon} aria-label="Edit"><Icon name="pencil" size={16} /></ToolbarButton>
      <ToolbarSeparator />
      <ToolbarText>100%</ToolbarText>
      <ToolbarButton size={icon} tone="destructive" aria-label="Delete"><Icon name="trash" size={16} /></ToolbarButton>
    </Toolbar>
  );
}

/** `plain`: no surface; the row sits in its host. The controls change `variant` and `size`. */
export const Plain: Story = {
  render: ({ dark, ...args }) => <Panel dark={dark} w={520}><Formatting {...args} /></Panel>,
};

/** `floating`: a raised card over content (a canvas's tools, a message's hover actions). */
export const Floating: Story = {
  args: { variant: 'floating' },
  render: ({ dark, ...args }) => (
    <Panel dark={dark} w={520} className="items-center bg-muted py-10"><Formatting {...args} /></Panel>
  ),
};

/** The three sizes: buttons 32 / 36 / 44px tall. */
export const Sizes: Story = {
  render: ({ dark, variant }) => (
    <Panel dark={dark} w={560} className="items-start">
      {(['sm', 'default', 'lg'] as const).map((size) => <Formatting key={size} variant={variant} size={size} />)}
    </Panel>
  ),
};

/** `disabled` on the root: every item is unavailable but the toolbar keeps its tab stop. */
export const Disabled: Story = {
  args: { variant: 'floating', disabled: true },
  render: ({ dark, ...args }) => <Panel dark={dark} w={520} className="items-center"><Formatting {...args} /></Panel>,
};

export const FloatingDark: Story = { ...Floating, args: { variant: 'floating', dark: true } };

/** `orientation="vertical"`: a tool palette. Up and Down move; separators run across. */
export const Vertical: Story = {
  render: ({ dark }) => (
    <Panel dark={dark} w={120} className="items-center">
      <Toolbar variant="floating" orientation="vertical" aria-label="Tools">
        <ToolbarButton size="icon" aria-label="Pencil"><Icon name="pencil" size={16} /></ToolbarButton>
        <ToolbarButton size="icon" aria-label="Text"><Icon name="textformat" size={16} /></ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton size="icon" tone="destructive" aria-label="Delete"><Icon name="trash" size={16} /></ToolbarButton>
      </Toolbar>
    </Panel>
  ),
};

/* ── `bar`: the iOS bottom bar. Edit mode over a List ── */

const PEOPLE = [
  ['Ada', 'Lovelace', 'Analyst'], ['Grace', 'Hopper', 'Admiral'], ['Alan', 'Turing', 'Mathematician'],
  ['Katherine', 'Johnson', 'Navigator'], ['Linus', 'Torvalds', 'Maintainer'], ['Margaret', 'Hamilton', 'Flight software'],
  ['Barbara', 'Liskov', 'Professor'], ['Ken', 'Thompson', 'Unix'], ['Radia', 'Perlman', 'Networks'],
] as const;

function EditMode({ initial = [] as string[] }) {
  const [picked, setPicked] = useState(() => new Set(initial));
  const [gone, setGone] = useState(() => new Set<string>());
  const [favorites, setFavorites] = useState(() => new Set<string>());
  const rows = PEOPLE.filter(([f]) => !gone.has(f));
  const allFavorite = picked.size > 0 && [...picked].every((id) => favorites.has(id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <div className="absolute inset-0 overflow-y-auto bg-background pt-4 pb-20">
        <List variant="inset">
          <ListSection title="Contacts">
            {rows.map(([f, l, role]) => (
              <ListRow key={f} title={`${f} ${l}`} description={role} icon={<Avatar name={`${f} ${l}`} />}
                editing checked={picked.has(f)} onClick={() => toggle(f)} />
            ))}
          </ListSection>
        </List>
      </div>
      <Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0 z-10">
        <ToolbarButton disabled={!picked.size}
          onClick={() => setFavorites((s) => { const n = new Set(s); picked.forEach((id) => (allFavorite ? n.delete(id) : n.add(id))); return n; })}>
          {allFavorite ? 'Unfavorite' : 'Favorite'}
        </ToolbarButton>
        <ToolbarText aria-live="polite">{picked.size ? `${picked.size} selected` : 'Select items'}</ToolbarText>
        <ToolbarButton tone="destructive" disabled={!picked.size}
          onClick={() => { setGone((g) => new Set([...g, ...picked])); setPicked(new Set()); }}>
          Delete
        </ToolbarButton>
      </Toolbar>
    </>
  );
}

/** `bar` with a selection: Favorite and Delete in the tint, the count announced between them. */
export const BarEditMode: Story = {
  render: ({ dark }) => <Phone dark={dark} h={560}><EditMode initial={['Grace', 'Alan']} /></Phone>,
};

/** `bar` with nothing selected: both actions grey (not faded) and still reachable with `aria-disabled`. */
export const BarEmpty: Story = {
  render: ({ dark }) => <Phone dark={dark} h={560}><EditMode /></Phone>,
};

export const BarDark: Story = {
  args: { dark: true },
  render: ({ dark }) => <Phone dark={dark} h={560}><EditMode initial={['Ada']} /></Phone>,
};

/** `bar` with `side="top"`: the hairline moves under the bar. */
export const BarTop: Story = {
  render: ({ dark }) => (
    <Phone dark={dark} h={220}>
      <Toolbar variant="bar" side="top" aria-label="Library" className="absolute inset-x-0 top-0">
        <ToolbarButton>Edit</ToolbarButton>
        <ToolbarText>24 items</ToolbarText>
        <ToolbarButton size="icon-lg" variant="ghost" aria-label="Add" className="text-primary"><Icon name="plus" size={20} /></ToolbarButton>
      </Toolbar>
    </Phone>
  ),
};
