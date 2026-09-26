import * as React from 'react';
import { useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within, expect, waitFor, screen } from 'storybook/test';
import { AppearanceProvider, type Appearance } from '@brett_lamy/ui';
import {
  AnnotateLightbox,
  Composer,
  ComposerAddon,
  ComposerAttach,
  ComposerAttachments,
  ComposerBump,
  ComposerBumpContent,
  ComposerBumpHandle,
  ComposerButton,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerOptions,
  ComposerOptionsOutlet,
  ComposerSelect,
  ComposerSend,
  ComposerSeparator,
  ComposerSpacer,
  ComposerStop,
  ComposerText,
  type ComposerAttachment,
  type ComposerCollapse,
} from './composer';
import { ModelPicker } from './model-picker';
import { WORKBENCH_MODELS, WORKBENCH_PROVIDERS } from './models';
import { WorkbenchComposer } from './workbench-composer';
import { WIcon } from './icons';
import { WorkbenchTheme } from './theme';
import '../styles.css';

/* ── frame ── */
function Frame({ appearance = 'dark', width = 560, height = 420, children }: { appearance?: Appearance; width?: number; height?: number; children: ReactNode }) {
  return (
    <AppearanceProvider value={appearance}>
      <WorkbenchTheme style={{ minHeight: height, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: width, width: '100%', margin: '0 auto' }}>{children}</div>
      </WorkbenchTheme>
    </AppearanceProvider>
  );
}

const meta: Meta = {
  title: 'Molecules/Workbench Composer',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

/* ── sample data ── */
const SHOT =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect width="560" height="340" fill="#1C1C23"/>' +
      '<rect x="24" y="24" width="512" height="60" rx="10" fill="#26262E"/>' +
      '<rect x="24" y="104" width="330" height="212" rx="10" fill="#101015"/>' +
      '<rect x="374" y="104" width="162" height="212" rx="10" fill="#0A84FF"/>' +
      '<text x="44" y="60" fill="#9C9CA6" font-family="ui-monospace,Menlo,monospace" font-size="15">pasted screenshot</text></svg>',
  );
/* The annotate story's image (unchanged from the original story). */
const SAMPLE_IMG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect width="560" height="340" fill="#1C1C23"/>' +
      '<rect x="24" y="24" width="512" height="60" rx="10" fill="#26262E"/>' +
      '<rect x="24" y="104" width="330" height="212" rx="10" fill="#101015"/>' +
      '<rect x="374" y="104" width="162" height="212" rx="10" fill="#26262E"/>' +
      '<text x="44" y="60" fill="#9C9CA6" font-family="ui-monospace,Menlo,monospace" font-size="15">pasted screenshot — click Save to flatten</text></svg>'
  );
const SEED_ATTACHMENTS: ComposerAttachment[] = [{ id: 'att-1', name: 'image.png', src: SHOT, size: 84 * 1024, type: 'image/svg+xml' }];
const SEED_MARKDOWN = 'The header overlaps the sidebar here ![image.png](attachment:att-1) — can you fix the z-index?';

const EFFORTS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium', short: 'Medium · 1M' },
  { id: 'high', label: 'High' },
];
const ACCESS = [
  { id: 'full', label: 'Full access', description: 'Read, write and run commands' },
  { id: 'read', label: 'Read only', description: 'Browse files, no edits' },
];

/* ── The Workbench default composition (WorkbenchComposer) ── */
export const Default: Story = { render: () => <Frame><WorkbenchComposer /></Frame> };
export const Streaming: Story = { render: () => <Frame><WorkbenchComposer streaming onStop={() => {}} /></Frame> };
export const Light: Story = { render: () => <Frame appearance="light"><WorkbenchComposer /></Frame> };

function LiveDemo() {
  const [streaming, setStreaming] = useState(false);
  const [sent, setSent] = useState<string>('');
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div>
      <WorkbenchComposer
        onSubmit={(markdown, attachments) => {
          setSent(`${markdown}${attachments.length ? `\n\n(${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''}`);
          setStreaming(true);
          if (t.current) clearTimeout(t.current);
          t.current = setTimeout(() => setStreaming(false), 2600);
        }}
        streaming={streaming}
        onStop={() => {
          if (t.current) clearTimeout(t.current);
          setStreaming(false);
        }}
      />
      <pre data-testid="sent" style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.6 }}>{sent}</pre>
    </div>
  );
}
export const Interactive: Story = { render: () => <Frame><LiveDemo /></Frame> };

/* ── The T3 Code composition: a draggable top bump, the card, the footer, a bottom bump ── */
interface T3Props {
  open?: boolean;
  defaultOpen?: boolean;
  attachments?: boolean;
  streaming?: boolean;
  collapsed?: ComposerCollapse;
  collapseOnScroll?: React.RefObject<HTMLElement | null>;
  collapseTo?: 'compact' | 'fab';
  topBump?: boolean;
}
function T3Composer({ open, defaultOpen, attachments = true, streaming = true, collapsed, collapseOnScroll, collapseTo, topBump = true }: T3Props) {
  const [busy, setBusy] = useState(streaming);
  return (
    <Composer
      defaultCollapsed={collapsed}
      collapseOnScroll={collapseOnScroll}
      collapseTo={collapseTo}
      streaming={busy}
      onStop={() => setBusy(false)}
      onSubmit={() => setBusy(true)}
      defaultAttachments={attachments ? SEED_ATTACHMENTS : []}
      defaultValue={attachments ? SEED_MARKDOWN : ''}
    >
      {topBump ? <ComposerBump side="top" draggable open={open} defaultOpen={defaultOpen} maxReveal={220}>
        <ComposerBumpContent label="Monitor output">
          <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-2 font-mono text-[11.5px] leading-[1.5] text-wb-label2">
            <div><span className="text-wb-green">✓</span> vite v6 ready in 412 ms</div>
            <div><span className="text-wb-green">✓</span> 287 stories indexed</div>
            <div><span className="text-wb-label3">…</span> watching packages/workbench/src</div>
            <div className="text-wb-label">→ composer.tsx changed, HMR update</div>
          </div>
        </ComposerBumpContent>
        <ComposerBumpHandle>
          <span className="size-[7px] shrink-0 animate-[wbPulse_1.6s_infinite] rounded-full bg-wb-green" />
          <ComposerText className="flex-1 text-wb-label">Monitoring <span className="text-wb-label3">· pnpm storybook</span></ComposerText>
          <ComposerButton variant="pill" className="py-[3px] text-[12px]">Stop</ComposerButton>
        </ComposerBumpHandle>
      </ComposerBump> : null}
      <ComposerCard size="lg">
        <ComposerAttachments />
        <ComposerInput placeholder="Ask anything — @ files, / commands, paste images" />
        <ComposerFooter className="gap-1 px-2.5 pb-2.5">
          {/* In the footer normally; in the bottom bump when compact. */}
          <ComposerOptions>
            <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} defaultValue="claude-opus-5-5" tint={false} className="text-wb-label" />
            <ComposerSeparator />
            <ComposerSelect aria-label="Effort" options={EFFORTS} defaultValue="medium" />
            <ComposerSeparator />
            <ComposerSelect aria-label="Access" icon="lock" options={ACCESS} />
          </ComposerOptions>
          <ComposerSpacer />
          <ComposerAttach />
          <ComposerStop variant="solid" />
          <ComposerSend morph={false} />
        </ComposerFooter>
      </ComposerCard>
      <ComposerBump side="bottom">
        <ComposerBumpHandle>
          <ComposerText icon="folder" className="shrink-0">Local checkout</ComposerText>
          <ComposerOptionsOutlet />
          <ComposerSpacer />
          <ComposerButton variant="pill" className="gap-1 py-0.5 font-normal text-[12px]">
            <WIcon name="branch" size={13} sw={1.9} />
            <span className="font-mono text-[11.5px]">main</span>
            <WIcon name="chevD" size={11} sw={2.4} className="opacity-60" />
          </ComposerButton>
        </ComposerBumpHandle>
      </ComposerBump>
    </Composer>
  );
}

export const T3Composition: Story = { name: 'T3 composition', render: () => <Frame height={560} width={620}><T3Composer /></Frame> };
export const T3CompositionLight: Story = { name: 'T3 composition (light)', render: () => <Frame appearance="light" height={560} width={620}><T3Composer /></Frame> };
export const DraggableBumpOpen: Story = { render: () => <Frame height={560} width={620}><T3Composer defaultOpen attachments={false} streaming={false} /></Frame> };

/* ── Collapse: compact (one row, options in the bottom bump), FAB, and scroll-linked ── */
export const Compact: Story = { render: () => <Frame height={420} width={720}><T3Composer collapsed="compact" topBump={false} attachments={false} /></Frame> };
export const CompactLight: Story = { render: () => <Frame appearance="light" height={420} width={720}><T3Composer collapsed="compact" topBump={false} attachments={false} /></Frame> };
export const Fab: Story = { render: () => <Frame height={420} width={720}><T3Composer collapsed="fab" topBump={false} attachments={false} streaming={false} /></Frame> };

/* A chat transcript under a pinned composer. It opens at the newest message (the bottom); scrolling up to read
   back folds the composer to one row, a flick (or a long scroll) folds it into the FAB, and scrolling back down
   — or tapping the FAB — brings it back. */
const THREAD: { who: 'me' | 'agent'; text: string }[] = [
  { who: 'me', text: 'Morning! Can you look at the shell layout before the release?' },
  { who: 'agent', text: 'Sure. I opened the shell in Storybook at 1400, 1024 and 390 px wide and read through the layout code first.' },
  { who: 'agent', text: 'Two things stand out: the sidebar drawer and the sticky header are siblings with competing z-indexes, and the drawer’s scrim is inside the main column.' },
  { who: 'me', text: 'Which one bites first?' },
  { who: 'agent', text: 'The z-index one. On narrow widths the header can paint over the open drawer. Want me to reproduce it?' },
  { who: 'me', text: 'Yes please, with a screenshot.' },
  { who: 'agent', text: 'Reproduced at 390 px: open the drawer and scroll the page a little — the header’s bottom edge slides over the drawer’s first row.' },
  { who: 'me', text: 'The sticky header overlaps the sidebar drawer on narrow widths.' },
  { who: 'agent', text: 'The header sits at z-index 20 and the drawer at 30, so the drawer should win — unless the header creates its own stacking context.' },
  { who: 'me', text: 'It has a backdrop-filter.' },
  { who: 'agent', text: 'That is it: backdrop-filter creates a stacking context, so the drawer is compared against the header’s parent. Moving the drawer out to the shell fixes it.' },
  { who: 'me', text: 'Do that, and keep the scrim under the header.' },
  { who: 'agent', text: 'Done — the drawer now portals into the shell and the scrim sits at 25. Storybook and the docs both look right.' },
  { who: 'me', text: 'Nice. Can you check the compact breakpoint as well?' },
  { who: 'agent', text: 'Checked 360, 390 and 430 px: the drawer covers the header and the hamburger stays reachable.' },
  { who: 'me', text: 'And the light appearance?' },
  { who: 'agent', text: 'Same result in light. The scrim is a touch lighter there, which matches the system sheets.' },
  { who: 'me', text: 'Ship it.' },
  { who: 'agent', text: 'Committed as “fix(shell): drawer above sticky header”. Anything else?' },
];

function ChatThread({ scroller, bottomPad = 170 }: { scroller: React.RefObject<HTMLDivElement | null>; bottomPad?: number }) {
  // Chats open at the newest message.
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scroller]);
  return (
    <div ref={scroller} data-testid="scroller" className="wb-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: `24px 24px ${bottomPad}px` }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wb-label3)', textAlign: 'center', padding: '4px 0 8px' }}>Thread · Fix the header overlap</div>
        {THREAD.map((m, i) =>
          m.who === 'me' ? (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="rounded-[14px_14px_4px_14px] bg-wb-fill2" style={{ padding: '9px 13px', fontSize: 14, lineHeight: 1.5, maxWidth: '78%' }}>{m.text}</div>
            </div>
          ) : (
            <div key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--wb-label)', padding: '2px 2px 6px' }}>{m.text}</div>
          ),
        )}
      </div>
    </div>
  );
}

function ScrollPage({ appearance = 'dark' }: { appearance?: Appearance }) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <AppearanceProvider value={appearance}>
      <WorkbenchTheme style={{ position: 'relative', height: 640, overflow: 'hidden' }}>
        <ChatThread scroller={scroller} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, padding: '0 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <T3Composer collapseOnScroll={scroller} collapseTo="fab" topBump={false} attachments={false} streaming={false} />
          </div>
        </div>
      </WorkbenchTheme>
    </AppearanceProvider>
  );
}
export const ScrollLinked: Story = { render: () => <ScrollPage /> };

/* ── Parts ── */
export const CardOnly: Story = {
  render: () => (
    <Frame>
      <Composer>
        <ComposerCard>
          <ComposerInput placeholder="Just the card, the input and send" />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </Frame>
  ),
};

/** Addons align like InputGroupAddon: block-start / block-end rows, inline-start / inline-end columns. */
export const Addons: Story = {
  render: () => (
    <Frame>
      <Composer defaultValue="Addons can sit on any side of the input.">
        <ComposerCard>
          <ComposerAddon align="block-start" className="pb-0">
            <ComposerText icon="doc">block-start · composer.tsx</ComposerText>
          </ComposerAddon>
          <ComposerAddon align="inline-start">
            <ComposerAttach />
          </ComposerAddon>
          <ComposerInput />
          <ComposerAddon align="inline-end">
            <ComposerSend />
          </ComposerAddon>
          <ComposerAddon align="block-end">
            <ComposerText icon="clock">block-end · 2.1k tokens</ComposerText>
          </ComposerAddon>
        </ComposerCard>
      </Composer>
    </Frame>
  ),
};

export const Buttons: Story = {
  render: () => (
    <Frame>
      <Composer defaultValue="x" streaming={false}>
        <div className="flex flex-wrap items-center gap-2">
          <ComposerButton aria-label="Ghost icon"><WIcon name="clip" size={15.5} sw={2} /></ComposerButton>
          <ComposerButton variant="pill"><WIcon name="lock" size={13.5} sw={2} />Pill<WIcon name="chevD" size={11} sw={2.4} className="opacity-60" /></ComposerButton>
          <ComposerButton variant="pill" tint><WIcon name="spark" size={13.5} sw={2} />Tint pill</ComposerButton>
          <ComposerSeparator />
          <ComposerSend />
          <ComposerStop variant="solid" forceMount />
          <ComposerStop forceMount />
          <ComposerExpand className="static" />
        </div>
      </Composer>
    </Frame>
  ),
};

export const Bumps: Story = {
  render: () => (
    <Frame>
      <Composer>
        <ComposerBump side="bottom">
          <ComposerBumpHandle><ComposerText icon="folder" className="flex-1">attached bottom bump</ComposerText><ComposerText icon="branch">main</ComposerText></ComposerBumpHandle>
        </ComposerBump>
        <ComposerCard size="lg">
          <ComposerInput placeholder="Bumps order themselves by side" />
          <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
        </ComposerCard>
        <ComposerBump side="top">
          <ComposerBumpHandle><span className="size-[7px] rounded-full bg-wb-tint" /><ComposerText className="flex-1">attached top bump (tucked)</ComposerText></ComposerBumpHandle>
        </ComposerBump>
        <ComposerBump side="bottom" variant="detached">
          <ComposerBumpHandle><ComposerText icon="doc">detached bottom bump</ComposerText></ComposerBumpHandle>
        </ComposerBump>
      </Composer>
    </Frame>
  ),
};

/** A pasted image: an inline chip in the text and a thumbnail in the strip (seeded). Hover the chip for the
    full image; click either to annotate. */
export const ImageChip: Story = {
  render: () => (
    <Frame>
      <WorkbenchComposer defaultAttachments={SEED_ATTACHMENTS} defaultValue={SEED_MARKDOWN} />
    </Frame>
  ),
};

export const SelectOpen: Story = {
  render: () => (
    <Frame height={460}>
      <Composer>
        <ComposerCard>
          <ComposerInput />
          <ComposerFooter>
            <ComposerSelect aria-label="Access" icon="lock" options={ACCESS} />
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: /Access/ }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
  },
};

/* ── ModelPicker ── */
function PickerFrame({ appearance }: { appearance: Appearance }) {
  return (
    <Frame appearance={appearance} height={560}>
      <div style={{ paddingTop: 380 }}>
        <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} defaultValue="claude-opus-5-5" defaultFavorites={['claude-opus-5-5', 'gpt-5-5']} />
      </div>
    </Frame>
  );
}
const openPicker: Story['play'] = async ({ canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /Model:/ }));
  await waitFor(() => expect(screen.getByRole('grid')).toBeTruthy());
};
export const ModelPickerOpen: Story = { render: () => <PickerFrame appearance="dark" />, play: openPicker };
export const ModelPickerOpenLight: Story = { render: () => <PickerFrame appearance="light" />, play: openPicker };

/* the annotate lightbox that opens when an attachment is clicked */
export const Annotate: Story = {
  render: () => <Frame><AnnotateLightbox src={SAMPLE_IMG} onClose={() => {}} onSave={() => {}} /></Frame>,
};
