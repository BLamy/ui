import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownEditor, type MarkdownEditorAttachment } from './markdown-editor';
import { Panel, Caption } from '../stories/primitive-frame';

const meta: Meta<typeof MarkdownEditor> = {
  title: 'Atoms/MarkdownEditor',
  component: MarkdownEditor,
  args: { placeholder: 'Write something — type / for blocks', variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'ghost', 'card'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    imagePaste: { control: 'inline-radio', options: ['inline', 'chip'] },
  },
  decorators: [(Story, ctx) => <Panel w={520} dark={ctx.parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof MarkdownEditor>;

const notes = `## Launch checklist

Ship the **tray drag** behind a flag, then flip it for *everyone*.

- [x] Haptics on detents
- [ ] Reduced-motion pass
- [ ] Docs page

> Keep the release threshold at \`0.4\`.`;

/* A tiny deterministic image, so chips and image blocks have something to show. */
const shot =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#0A84FF"/><stop offset="1" stop-color="#BF5AF2"/></linearGradient></defs><rect width="320" height="200" rx="18" fill="url(#g)"/><circle cx="92" cy="86" r="30" fill="#fff" opacity=".85"/><path d="M0 200 L120 110 L200 170 L250 130 L320 190 L320 200Z" fill="#fff" opacity=".35"/></svg>',
  );

export const Default: Story = { args: { 'aria-label': 'Notes' } };

const states = (
  <>
    <Caption>Default</Caption>
    <MarkdownEditor aria-label="Empty" placeholder="Write something — type / for blocks" />
    <MarkdownEditor aria-label="Filled" defaultValue={notes} />
    <Caption>Card · small</Caption>
    <MarkdownEditor aria-label="Card" variant="card" size="sm" defaultValue={'A **card** editor with `sm` type.'} />
    <Caption>Ghost</Caption>
    <MarkdownEditor aria-label="Ghost" variant="ghost" minHeight={0} defaultValue={'No chrome — text on the surface it sits on.'} />
    <Caption>Disabled · invalid</Caption>
    <MarkdownEditor aria-label="Disabled" disabled minHeight={0} defaultValue="Disabled" />
    <MarkdownEditor aria-label="Invalid" invalid minHeight={0} defaultValue="Too short" />
  </>
);

export const Light: Story = { render: () => states };
export const Dark: Story = { parameters: { dark: true }, render: () => states };

function ImagePasteDemo() {
  const [attachments, setAttachments] = useState<MarkdownEditorAttachment[]>([
    { id: 'att-demo', name: 'onboarding.png', src: shot, size: 48_213, type: 'image/png' },
  ]);
  return (
    <>
      <Caption>imagePaste="chip" — the host stores the file</Caption>
      <MarkdownEditor
        aria-label="Chip paste"
        imagePaste="chip"
        minHeight={0}
        defaultValue={'The empty state looks off here ![onboarding.png](attachment:att-demo) — can we tighten it?'}
        attachments={attachments}
        onAttachmentAdd={({ file: _file, ...a }) => setAttachments((all) => [...all, a])}
        onAttachmentRemove={(ids) => setAttachments((all) => all.filter((a) => !ids.includes(a.id)))}
      />
      <Caption>imagePaste="inline" — an image block, as it will render</Caption>
      <MarkdownEditor aria-label="Inline paste" imagePaste="inline" defaultValue={`Paste or drop an image:\n\n![Mock](${shot})`} />
    </>
  );
}

export const ImagePaste: Story = { render: () => <ImagePasteDemo /> };

export const ReadOnly: Story = { args: { readOnly: true, defaultValue: notes, 'aria-label': 'Read-only notes' } };

export const WithToolbar: Story = { args: { toolbar: true, defaultValue: notes, 'aria-label': 'Notes with toolbar' } };

export const InCard: Story = {
  args: { variant: 'card', toolbar: true, minHeight: 180, defaultValue: notes, 'aria-label': 'Card editor' },
};

function ControlledDemo() {
  const [markdown, setMarkdown] = useState('Edit me — **bold**, `code`, and a list:\n\n- one\n- two');
  return (
    <>
      <MarkdownEditor aria-label="Controlled" value={markdown} onValueChange={setMarkdown} minHeight={120} />
      <Caption>Live Markdown</Caption>
      <pre className="m-0 overflow-auto rounded-[10px] bg-card p-3 shadow-[0_0_0_1px_var(--border)] font-mono text-[12px] leading-[18px] whitespace-pre-wrap text-muted-foreground">
        {markdown}
      </pre>
    </>
  );
}

export const Controlled: Story = { render: () => <ControlledDemo /> };

const styledDoc = `Groceries for Saturday

- [x] Oat milk
- [ ] Sourdough
- [ ] Figs

| Item | Qty |
| --- | --- |
| Lemons | 4 |
| Basil | 1 bunch |`;

/** `classNames` restyles the document's parts with plain utilities — here a Notes-like title line, round checklist
    circles and hairline tables. The editor's stylesheet is layered under utilities, so no `!important`. */
export const StyledParts: Story = {
  args: {
    variant: 'ghost',
    'aria-label': 'Styled note',
    defaultValue: styledDoc,
    classNames: {
      title: 'text-[26px] leading-[1.2] font-bold tracking-[-.4px] mb-2',
      checklist: 'pl-0',
      checklistItem: 'gap-2.5 items-center',
      checkbox: 'appearance-none m-0 size-[20px] rounded-full shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))] checked:bg-primary checked:shadow-none',
      table: 'text-[14px]',
      tableHeader: 'bg-transparent font-semibold border-border px-3 py-1.5',
      tableCell: 'border-border px-3 py-1.5',
    },
  },
};
