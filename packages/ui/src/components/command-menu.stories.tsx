import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CommandEmpty, CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList, CommandMenu, CommandPage,
  useCommandActive, type CommandMenuProps,
} from './command-menu';
import { Badge } from './badge';
import { Button } from './button';
import { Pad } from '../stories/frame';

const meta: Meta<typeof CommandMenu> = {
  title: 'Organisms/CommandMenu',
  component: CommandMenu,
};
export default meta;
type Story = StoryObj<typeof CommandMenu>;

const PROJECTS = [
  { name: 'ui', path: '~/Code/ui', color: '#30D158' },
  { name: 'wasm-vm', path: '~/Code/wasm-vm', color: '#FFD60A' },
  { name: 'electric-forest', path: '~/Code/electric-forest', color: '#A4E34F' },
  { name: 'docs-site', path: '~/Code/docs-site', color: '#64D2FF' },
  { name: 'Codex', path: '~/Code', color: '#FF9F0A' },
];

function Monogram({ name, color }: { name: string; color: string }) {
  const letters = (name.match(/[A-Za-z0-9]+/g) ?? [name]).slice(0, 2).map((w) => w[0]).join('').toUpperCase().padEnd(2, name[1]?.toUpperCase() ?? '');
  return (
    <span
      className="grid size-6 place-items-center rounded-[6px] font-mono text-[10.5px] font-bold"
      style={{ color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      {letters}
    </span>
  );
}

function Palette(props: Partial<CommandMenuProps> & { children?: ReactNode }) {
  return (
    <CommandMenu aria-label="Command menu" {...props}>
      <CommandInput placeholder="Search commands, projects, and threads…" />
      <CommandList>
        <CommandEmpty>No matching commands</CommandEmpty>
        <CommandPage id="root">
          <CommandGroup heading="Actions">
            <CommandItem icon="square-pencil" title="New thread in ui" value="New thread in ui" shortcut="⇧⌘O" />
            <CommandItem icon="square-pencil" title="New thread in…" page="projects" />
            <CommandItem icon="link" title="Copy thread ID" description="b7578c63-c54a-4669-a6a1-51348cf0177b" shortcut="⇧⌘C" />
            <CommandItem icon="branch" title="Show linked pull requests" disabled />
            <CommandItem icon="doc-text" title="Go to file" shortcut="⌘P" />
            <CommandItem icon="magnifier" title="Search project contents" shortcut="⇧⌘F" />
            <CommandItem icon="folder-plus" title="Add project" page="add-project" />
          </CommandGroup>
          <CommandGroup heading="Threads">
            <CommandItem icon="bubble-left" title="Fix composer grabber" description="ui · 2h ago" />
            <CommandItem icon="bubble-left" title="Command menu primitive" description="ui · yesterday" />
          </CommandGroup>
        </CommandPage>
        <CommandPage id="projects" numbered>
          <CommandGroup heading="Projects">
            {PROJECTS.map((p) => (
              <CommandItem key={p.name} icon={<Monogram name={p.name} color={p.color} />} title={p.name} description={`Local · ${p.path}`} />
            ))}
          </CommandGroup>
        </CommandPage>
        <CommandPage id="add-project">
          <CommandGroup heading="Sources">
            <CommandItem icon="folder-plus" title="Local folder" description="Browse a folder on disk" />
            <CommandItem icon="link" title="Git URL" description="Clone from a remote URL" />
            <CommandItem icon="network" title="Bitbucket repository" description="Clone Bitbucket workspace/repository" dimmed
              badge={<Badge variant="outline" className="rounded-md text-warning shadow-[inset_0_0_0_1px_var(--border)]">Setup Required</Badge>} />
          </CommandGroup>
        </CommandPage>
      </CommandList>
      <CommandFooter />
      {props.children}
    </CommandMenu>
  );
}

const frame = (node: ReactNode, dark = false) => <Pad w={620} dark={dark}>{node}</Pad>;

export const Inline: Story = { render: () => frame(<Palette />) };
export const InlineDark: Story = { render: () => frame(<Palette />, true) };
/** Opened on a sub-page: the back arrow replaces the search icon and the footer adds Backspace Back. */
export const SubPage: Story = { render: () => frame(<Palette defaultPages={['projects']} />, true) };
export const DimmedWithBadge: Story = { render: () => frame(<Palette defaultPages={['add-project']} />, true) };

function Filtered({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  return <Palette query={q} onQueryChange={setQ} />;
}
/** Fuzzy matching ranks within each group and highlights the matched characters. */
export const Filtering: Story = { render: () => frame(<Filtered initial="thr" />, true) };
export const Empty: Story = { render: () => frame(<Filtered initial="zzzz" />) };

const EMOJI = ['😀', '😂', '🥹', '😍', '🤔', '😎', '🥳', '😴', '👍', '👏', '🙏', '🔥', '✨', '🎉', '❤️', '💯', '🚀', '🌈', '🍕', '☕️', '🐶', '🐱', '🌵', '⚡️'];
const EMOJI_NAMES = ['grinning', 'joy', 'holding back tears', 'heart eyes', 'thinking', 'sunglasses', 'party', 'sleeping', 'thumbs up', 'clap', 'pray', 'fire', 'sparkles', 'tada', 'heart', '100', 'rocket', 'rainbow', 'pizza', 'coffee', 'dog', 'cat', 'cactus', 'zap'];

function EmojiPreview() {
  const v = useCommandActive();
  return <span className="text-[13px] text-muted-foreground">{v ?? ''}</span>;
}

/** A `columns` group is a grid: ← → step, ↑ ↓ move a row. */
export const Grid: Story = {
  render: () =>
    frame(
      <CommandMenu aria-label="Emoji">
        <CommandInput placeholder="Search emoji…" />
        <CommandList>
          <CommandEmpty />
          <CommandGroup heading="Smileys & more" columns={8}>
            {EMOJI.map((e, i) => (
              <CommandItem key={e} value={EMOJI_NAMES[i]} className="text-[24px]">{e}</CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <CommandFooter legend={[{ keys: ['←', '→', '↑', '↓'], label: 'Move' }, { keys: ['Enter'], label: 'Copy' }]}>
          <EmojiPreview />
        </CommandFooter>
      </CommandMenu>,
      true,
    ),
};

function DialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="relative h-[600px]">
      <Button onPress={() => setOpen(true)}>Open ⌘K</Button>
      <Palette variant="dialog" isOpen={open} onOpenChange={setOpen} hotkey="mod+k" />
    </div>
  );
}
export const Dialog: Story = { render: () => frame(<DialogDemo />, true) };
