import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Composer,
  ComposerAdd,
  ComposerAttachments,
  ComposerBump,
  ComposerBumpHandle,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerOptions,
  ComposerOptionsOutlet,
  ComposerPill,
  ComposerSelect,
  ComposerSend,
  ComposerSeparator,
  ComposerSpacer,
  ComposerStop,
  ComposerText,
  type ComposerAttachment,
  type ComposerProps,
} from '@/components/ui/composer/composer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/lib/icon';
import { AppearanceProvider, ThemeScope, type Appearance, type ThemeScopeName } from '@/lib/theme';

/* The Composer is a container: it fills the width it is given (`w-full max-w-…`), so a phone-sized canvas shows its
   narrow layout. Stories render in a theme scope (`chat` by default) and either appearance. */
function Frame({ appearance = 'light', scope = 'chat', children }: { appearance?: Appearance; scope?: ThemeScopeName; children: ReactNode }) {
  return (
    <AppearanceProvider value={appearance}>
      <ThemeScope scope={scope} className="flex min-h-dvh flex-col justify-center bg-background p-6 font-sans text-foreground">
        <div className="mx-auto w-full max-w-[600px]">{children}</div>
      </ThemeScope>
    </AppearanceProvider>
  );
}

const meta: Meta = {
  title: 'Molecules/Composer',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const EFFORT = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium', short: 'Medium · 1M' },
  { value: 'high', label: 'High', description: 'Thinks longer' },
];
const ACCESS = [
  { value: 'full', label: 'Full access', description: 'Read, write and run commands' },
  { value: 'read', label: 'Read only', description: 'Browse files, no edits' },
  { value: 'ask', label: 'Ask first', description: 'Confirm every change' },
];

const SHOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240"><rect width="420" height="240" fill="#1e293b"/><rect x="24" y="24" width="200" height="14" rx="7" fill="#64748b"/><rect x="24" y="52" width="320" height="10" rx="5" fill="#475569"/><rect x="24" y="150" width="120" height="60" rx="10" fill="#0a84ff"/></svg>');
const MIXED: ComposerAttachment[] = [
  { id: 'img', name: 'header.png', src: SHOT, size: 84 * 1024, type: 'image/svg+xml' },
  { id: 'code', name: 'chat.tsx', type: 'text/tsx', kind: 'text', size: 2300, excerpt: "export function Chat() {\n  const [draft, setDraft] = useState('')\n  return <Composer value={draft} />\n}" },
  { id: 'pdf', name: 'Design review.pdf', type: 'application/pdf', kind: 'pdf', size: 1.3 * 1024 * 1024 },
  { id: 'audio', name: 'voice-note.m4a', type: 'audio/mp4', kind: 'audio', size: 612 * 1024 },
  { id: 'zip', name: 'logs.zip', type: 'application/zip', kind: 'archive', size: 3.4 * 1024 * 1024 },
];

/** The everyday composition: attachments, editor, expand, option pills, add and send. */
function Full(props: Omit<ComposerProps, 'children'>) {
  return (
    <Composer {...props}>
      <ComposerCard>
        <ComposerExpand />
        <ComposerAttachments />
        <ComposerInput placeholder="Ask anything — @ files, / commands, paste images" />
        <ComposerFooter>
          <ComposerOptions>
            <ComposerSelect aria-label="Effort" items={EFFORT} defaultValue="medium" />
            <ComposerSeparator />
            <ComposerSelect aria-label="Access" icon="lock-rounded" items={ACCESS} />
          </ComposerOptions>
          <ComposerSpacer />
          <ComposerAdd icon="paperclip-diagonal" label="Attach files" />
          <ComposerStop />
          <ComposerSend morph={false} />
        </ComposerFooter>
      </ComposerCard>
      <ComposerBump side="bottom" variant="detached">
        <ComposerBumpHandle>
          <ComposerText icon="folder-closed">Local checkout</ComposerText>
          <ComposerOptionsOutlet />
          <ComposerSpacer />
          <ComposerText icon="branch">main</ComposerText>
        </ComposerBumpHandle>
      </ComposerBump>
    </Composer>
  );
}

/** The smallest useful composer: an editor and a send button. */
export const Minimal: Story = {
  render: () => (
    <Frame>
      <Composer>
        <ComposerCard>
          <ComposerInput placeholder="Message" />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </Frame>
  ),
};

export const Default: Story = { render: () => <Frame><Full defaultValue="Refactor the composer onto the kit's menus" /></Frame> };
export const Dark: Story = { render: () => <Frame appearance="dark"><Full defaultValue="Refactor the composer onto the kit's menus" /></Frame> };
export const Workbench: Story = { render: () => <Frame scope="workbench" appearance="dark"><Full defaultValue="In the workbench scope" /></Frame> };
export const WorkbenchLight: Story = { render: () => <Frame scope="workbench"><Full defaultValue="In the workbench scope, light" /></Frame> };

/** Every kind of file: an image thumbnail (press to annotate), code's first lines, a PDF, audio and an archive. */
export const Attachments: Story = { render: () => <Frame><Full defaultAttachments={MIXED} /></Frame> };
export const AttachmentsDark: Story = { render: () => <Frame appearance="dark"><Full defaultAttachments={MIXED} /></Frame> };

/** A reply is streaming: send stays an arrow (`morph={false}`) and ComposerStop pops in beside it. */
export const Streaming: Story = { render: () => <Frame><Full streaming /></Frame> };

/** `disabled`: nothing can be typed, attached, chosen or sent (a credit limit, a read-only thread). */
export const Disabled: Story = { render: () => <Frame><Full disabled defaultValue="Out of credits" /></Frame> };

/** One row: the options move into the bottom bump. */
export const Compact: Story = { render: () => <Frame><Full defaultCollapsed="compact" /></Frame> };

/** Folded into its FAB (`fabAlign` places it). */
export const Fab: Story = { render: () => <Frame><Full defaultCollapsed="fab" collapseTo="fab" /></Frame> };

/** A 360px column: the option pills stay on one line and scroll sideways instead of wrapping. */
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <Frame>
      <div className="mx-auto w-full max-w-[360px]">
        <Full defaultAttachments={MIXED.slice(0, 2)} />
      </div>
    </Frame>
  ),
};

/** The effort menu, open: it is the kit's `DropdownMenuContent size="sm"` with radio items. */
export const SelectOpen: Story = {
  render: () => (
    <Frame>
      <div className="pt-48">
        <Full />
      </div>
    </Frame>
  ),
};

/* Kit parity: the composer's pill, menu and buttons next to the kit's own parts, in one scope. */
function Parity({ appearance, scope }: { appearance?: Appearance; scope?: ThemeScopeName }) {
  return (
    <Frame appearance={appearance} scope={scope}>
      <div className="grid gap-6 pt-40">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 text-caption text-muted-foreground">Composer</span>
          <Composer>
            <div className="flex items-center gap-2">
              <ComposerSelect aria-label="Effort" items={EFFORT} defaultValue="medium" />
              <ComposerPill icon="asterisk" className="text-primary">Opus 5.5</ComposerPill>
              <ComposerAdd />
              <ComposerSend />
            </div>
          </Composer>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 text-caption text-muted-foreground">Kit</span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="quiet" size="sm" />}>Effort</DropdownMenuTrigger>
            <DropdownMenuContent size="sm" side="top" align="start">
              <DropdownMenuRadioGroup defaultValue="medium">
                {EFFORT.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value} description={o.description}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="quiet" size="icon-sm" aria-label="Add">
            <Icon name="plus" size={17} sw={2} />
          </Button>
          <Button size="icon" aria-label="Send">
            <Icon name="arrow-up-compact" size={16} sw={2.4} />
          </Button>
        </div>
      </div>
    </Frame>
  );
}
export const KitParity: Story = { render: () => <Parity /> };
export const KitParityDark: Story = { render: () => <Parity appearance="dark" /> };
export const KitParityWorkbench: Story = { render: () => <Parity scope="workbench" appearance="dark" /> };
