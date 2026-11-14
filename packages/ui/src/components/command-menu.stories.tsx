import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CommandMenu, CommandMenuDialog, CommandMenuDialogContent, CommandMenuEmpty, CommandMenuFooter, CommandMenuGroup,
  CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem, CommandMenuList, CommandMenuPage, CommandMenuShortcut, CommandMenuStatus,
  useCommandMenuValue, type CommandMenuData, type CommandMenuProps,
} from '@/components/ui/command-menu';
import { DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

/** Keys the app handles itself: shown, not registered, so a story never takes ⌘P from the page. */
const keys = (shortcut: string) => <CommandMenuShortcut shortcut={shortcut} />;

function Palette(props: Partial<CommandMenuProps>) {
  return (
    <CommandMenu {...props}>
      <CommandMenuInput placeholder="Search commands, projects, and threads…" />
      <CommandMenuEmpty>No matching commands</CommandMenuEmpty>
      <CommandMenuList>
        <CommandMenuPage>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
            <CommandMenuItem icon="square-pencil" title="New thread in ui" trailing={keys('shift+mod+o')} />
            <CommandMenuItem icon="square-pencil" title="New thread in…" page="projects" />
            <CommandMenuItem icon="link" title="Copy thread ID" description="b7578c63-c54a-4669-a6a1-51348cf0177b" trailing={keys('shift+mod+c')} />
            <CommandMenuItem icon="branch" title="Show linked pull requests" disabled />
            <CommandMenuItem icon="doc-text" title="Go to file" trailing={keys('mod+p')} />
            <CommandMenuItem icon="magnifier" title="Search project contents" trailing={keys('shift+mod+f')} />
            <CommandMenuItem icon="folder-plus" title="Add project" page="add-project" />
          </CommandMenuGroup>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Threads</CommandMenuGroupLabel>
            <CommandMenuItem icon="bubble-left" title="Fix composer grabber" description="ui · 2h ago" />
            <CommandMenuItem icon="bubble-left" title="Command menu primitive" description="ui · yesterday" />
          </CommandMenuGroup>
        </CommandMenuPage>
        <CommandMenuPage value="projects" numbered>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
            {PROJECTS.map((p) => (
              <CommandMenuItem key={p.name} icon={<Monogram name={p.name} color={p.color} />} title={p.name} description={`Local · ${p.path}`} />
            ))}
          </CommandMenuGroup>
        </CommandMenuPage>
        <CommandMenuPage value="add-project">
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Sources</CommandMenuGroupLabel>
            <CommandMenuItem icon="folder-plus" title="Local folder" description="Browse a folder on disk" />
            <CommandMenuItem icon="link" title="Git URL" description="Clone from a remote URL" />
            <CommandMenuItem icon="network" title="Bitbucket repository" description="Clone Bitbucket workspace/repository" dimmed
              trailing={<Badge variant="outline" className="rounded-md text-warning shadow-[inset_0_0_0_1px_var(--border)]">Setup Required</Badge>} />
          </CommandMenuGroup>
        </CommandMenuPage>
      </CommandMenuList>
      <CommandMenuFooter />
    </CommandMenu>
  );
}

const frame = (node: ReactNode, dark = false) => <Pad w={620} dark={dark}>{node}</Pad>;

export const Inline: Story = { render: () => frame(<Palette />) };
export const InlineDark: Story = { render: () => frame(<Palette />, true) };
/** Opened on a page below the first: the back button replaces the search icon and the footer adds Backspace Back. */
export const SubPage: Story = { render: () => frame(<Palette defaultPages={['projects']} />, true) };
export const DimmedWithBadge: Story = { render: () => frame(<Palette defaultPages={['add-project']} />, true) };

/** Typing keeps the commands that match, in their order, and marks the letters that matched. */
export const Filtering: Story = { render: () => frame(<Palette defaultQuery="thr" />, true) };
export const Empty: Story = { render: () => frame(<Palette defaultQuery="zzzz" />) };

const DATA: CommandMenuData = [
  {
    type: 'group',
    label: 'Actions',
    items: [
      { value: 'new-thread', label: 'New thread in ui', icon: 'square-pencil' },
      { value: 'copy-id', label: 'Copy thread ID', icon: 'link', description: 'b7578c63-c54a-4669-a6a1-51348cf0177b' },
      { value: 'go-to-file', label: 'Go to file', icon: 'doc-text' },
      { value: 'projects', label: 'New thread in…', icon: 'square-pencil', items: PROJECTS.map((p) => ({ value: p.name, label: p.name, description: `Local · ${p.path}` })) },
    ],
  },
  { type: 'separator' },
  {
    type: 'group',
    label: 'Threads',
    items: [
      { value: 'thread-1', label: 'Fix composer grabber', icon: 'bubble-left', description: 'ui · 2h ago' },
      { value: 'thread-2', label: 'Thread list virtualization', icon: 'bubble-left', description: 'ui · yesterday' },
    ],
  },
];

/** Commands given as `items` are ranked as you type: the best match, and its group, lead. */
export const Ranked: Story = {
  render: () =>
    frame(
      <CommandMenu items={DATA} defaultQuery="thr">
        <CommandMenuInput placeholder="Search commands and threads…" />
        <CommandMenuEmpty />
        <CommandMenuList />
        <CommandMenuFooter />
      </CommandMenu>,
      true,
    ),
};

/** `status="loading"` marks the list busy; CommandMenuStatus says so. */
export const Loading: Story = {
  render: () =>
    frame(
      <CommandMenu status="loading" filter={false}>
        <CommandMenuInput placeholder="Search issues…" />
        <CommandMenuStatus>{(state) => (state.loading ? 'Searching…' : null)}</CommandMenuStatus>
        <CommandMenuList>
          <CommandMenuItem icon="exclamation-circle" title="Login button does nothing on Safari" description="#412 · open" />
        </CommandMenuList>
        <CommandMenuFooter />
      </CommandMenu>,
    ),
};

const EMOJI = ['😀', '😂', '🥹', '😍', '🤔', '😎', '🥳', '😴', '👍', '👏', '🙏', '🔥', '✨', '🎉', '❤️', '💯', '🚀', '🌈', '🍕', '☕️', '🐶', '🐱', '🌵', '⚡️'];
const EMOJI_NAMES = ['grinning', 'joy', 'holding back tears', 'heart eyes', 'thinking', 'sunglasses', 'party', 'sleeping', 'thumbs up', 'clap', 'pray', 'fire', 'sparkles', 'tada', 'heart', '100', 'rocket', 'rainbow', 'pizza', 'coffee', 'dog', 'cat', 'cactus', 'zap'];

function EmojiPreview() {
  const v = useCommandMenuValue();
  return <span className="text-[13px] text-muted-foreground">{v ?? ''}</span>;
}

/** A `columns` group is a grid: the arrows move by cell and by row. */
export const Grid: Story = {
  render: () =>
    frame(
      <CommandMenu>
        <CommandMenuInput placeholder="Search emoji…" />
        <CommandMenuEmpty />
        <CommandMenuList>
          <CommandMenuGroup columns={8}>
            <CommandMenuGroupLabel>Smileys & more</CommandMenuGroupLabel>
            {EMOJI.map((e, i) => (
              <CommandMenuItem key={e} value={EMOJI_NAMES[i]} label={EMOJI_NAMES[i]} className="text-[24px]">{e}</CommandMenuItem>
            ))}
          </CommandMenuGroup>
        </CommandMenuList>
        <CommandMenuFooter legend={[{ keys: ['←', '→', '↑', '↓'], label: 'Move' }, { keys: ['Enter'], label: 'Copy' }]}>
          <EmojiPreview />
        </CommandMenuFooter>
      </CommandMenu>,
      true,
    ),
};

function DialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="relative h-[600px]">
      <CommandMenuDialog open={open} onOpenChange={setOpen}>
        <DialogTrigger shortcut="mod+k" render={<Button />}>Open ⌘K</DialogTrigger>
        <CommandMenuDialogContent aria-label="Command menu">
          <Palette />
        </CommandMenuDialogContent>
      </CommandMenuDialog>
    </div>
  );
}
export const Dialog: Story = { render: () => frame(<DialogDemo />, true) };
