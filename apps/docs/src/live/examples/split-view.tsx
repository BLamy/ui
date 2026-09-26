/* SplitView live examples: Mail (three columns), Notes (two columns), Settings (sidebar behaviours) and a
   resizable frame that morphs between the width classes. The previews render the shared compositions from
   @brett_lamy/ui; each `code` is the copy-pasteable version of the same composition. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SplitViewMailDemo, SplitViewNotesDemo, SplitViewResizableDemo, SplitViewSettingsDemo,
} from '@brett_lamy/ui';
import type { LiveSpec } from '../frame';

/** Lays a composition out at a real device width, scaled down (never up) to fit, centered. */
function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const resize = () => setScale(Math.min(1, el.clientWidth / width));
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={host} style={{ width: '100%', height: height * scale, position: 'relative' }}>
      <div style={{
        position: 'absolute', left: '50%', width, height, marginLeft: -(width * scale) / 2, transform: `scale(${scale})`, transformOrigin: 'top left',
        borderRadius: 14 / scale, overflow: 'hidden', boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.12)',
      }}>{children}</div>
    </div>
  );
}

const Caption = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12.5, color: 'var(--bl-label2)', textAlign: 'center', marginTop: 10, lineHeight: 1.45 }}>{children}</div>
);

const SIZES = [
  { id: 'regular', label: 'Regular', width: 1120 },
  { id: 'medium', label: 'Medium', width: 820 },
  { id: 'compact', label: 'Compact', width: 390 },
];
const sizeOf = (v: string) => SIZES.find((s) => s.id === v) ?? SIZES[0];

const MAIL_CODE = `import { useState } from 'react'
import {
  SplitView, SplitViewSidebar, SplitViewSupplementary, SplitViewDetail,
  SplitViewHeader, SplitViewContent, SplitViewItem, SplitViewToggle, SplitViewEmpty,
  useSplitView,
} from '@brett_lamy/ui'

const MAILBOXES = [{ id: 'inbox', title: 'Inbox' }, { id: 'sent', title: 'Sent' }]
const MAIL = {
  inbox: [{ id: 'm1', from: 'Amelia Adler', subject: 'Spring presets' }],
  sent: [{ id: 's1', from: 'Brett Lamy', subject: 'Re: SplitView review' }],
}

function Mailboxes() {
  return (
    <SplitViewSidebar aria-label="Mailboxes">
      <SplitViewHeader title="Mailboxes" />
      <SplitViewContent className="px-2.5">
        {MAILBOXES.map((m) => <SplitViewItem key={m.id} id={m.id} title={m.title} />)}
      </SplitViewContent>
    </SplitViewSidebar>
  )
}

function Messages() {
  const { selection } = useSplitView()
  const box = selection.sidebar ?? 'inbox'
  return (
    <SplitViewSupplementary width={340}>
      {/* The toggle stays put while the sidebar slides; collapsed, a back button takes its place. */}
      <SplitViewHeader title={box} leading={<SplitViewToggle />} />
      <SplitViewContent>
        {MAIL[box].map((m) => <SplitViewItem key={m.id} id={m.id} title={m.from} subtitle={m.subject} />)}
      </SplitViewContent>
    </SplitViewSupplementary>
  )
}

function Message() {
  const { selection } = useSplitView()
  const msg = Object.values(MAIL).flat().find((m) => m.id === selection.supplementary)
  return (
    <SplitViewDetail>
      <SplitViewHeader title={msg?.subject} />
      {msg ? <SplitViewContent>…</SplitViewContent> : <SplitViewEmpty title="No Message Selected" />}
    </SplitViewDetail>
  )
}

// Regular: three tiled columns. Medium: the sidebar floats over list + message.
// Compact: one column at a time — picking a row pushes, back / Esc / edge-swipe pops.
export default function Mail() {
  return (
    <div style={{ height: 560 }}>
      <SplitView defaultSelection={{ sidebar: 'inbox', supplementary: 'm1' }}>
        <Mailboxes />
        <Messages />
        <Message />
      </SplitView>
    </div>
  )
}`;

const NOTES_CODE = `import {
  SplitView, SplitViewSidebar, SplitViewDetail, SplitViewHeader, SplitViewContent,
  SplitViewItem, SplitViewToggle, useSplitView,
} from '@brett_lamy/ui'

const NOTES = [
  { id: 'n1', title: 'Family Values', body: 'Things fly, they never teleport.' },
  { id: 'n2', title: 'Spring presets', body: 'snappy · smooth · tray · bouncy' },
]

function Editor() {
  const { selection } = useSplitView()
  const note = NOTES.find((n) => n.id === selection.sidebar)
  return (
    <SplitViewDetail>
      {/* Hiding the list slides it away and widens the editor in the same spring. */}
      <SplitViewHeader leading={<SplitViewToggle />} />
      <SplitViewContent className="p-7">
        <h2>{note?.title}</h2>
        <p>{note?.body}</p>
      </SplitViewContent>
    </SplitViewDetail>
  )
}

// Two columns: the list is the sidebar. Compact starts on the list.
export default function Notes() {
  return (
    <div style={{ height: 520 }}>
      <SplitView defaultSelection={{ sidebar: 'n1' }} defaultCompactColumn="sidebar">
        <SplitViewSidebar width={300} className="bg-background">
          <SplitViewHeader title="Notes" />
          <SplitViewContent className="px-2.5">
            {NOTES.map((n) => <SplitViewItem key={n.id} id={n.id} title={n.title} subtitle={n.body} />)}
          </SplitViewContent>
        </SplitViewSidebar>
        <Editor />
      </SplitView>
    </div>
  )
}`;

const settingsCode = (variant: string) => `import { useState } from 'react'
import {
  SplitView, SplitViewSidebar, SplitViewDetail, SplitViewHeader, SplitViewContent,
  SplitViewItem, SplitViewToggle, useSplitView,
} from '@brett_lamy/ui'

const SECTIONS = ['Wi-Fi', 'Notifications', 'Sounds & Haptics', 'Focus']

function Pane() {
  const { selection } = useSplitView()
  return (
    <SplitViewDetail className="bg-muted">
      <SplitViewHeader title={selection.sidebar} leading={<SplitViewToggle />} />
      <SplitViewContent>…</SplitViewContent>
    </SplitViewDetail>
  )
}

export default function Settings() {
${variant === 'tile'
    ? `  // Regular width: the sidebar tiles; the toggle slides it away and the detail widens.
  return (
    <SplitView defaultSelection={{ sidebar: 'Notifications' }}>`
    : `  // Medium width: '${variant}' ${variant === 'overlay' ? 'floats the sidebar over the detail behind a scrim' : 'pushes the detail aside, keeping its width'}.
  // Tap the scrim, press Esc, or pick a row to dismiss.
  const [open, setOpen] = useState(true)
  return (
    <SplitView
      sidebarBehavior="${variant}"
      sidebarVisible={open}
      onSidebarVisibleChange={setOpen}
      defaultSelection={{ sidebar: 'Notifications' }}
    >`}
      <SplitViewSidebar width={300}>
        <SplitViewHeader title="Settings" />
        <SplitViewContent className="px-2.5">
          {SECTIONS.map((s) => <SplitViewItem key={s} id={s} title={s} />)}
        </SplitViewContent>
      </SplitViewSidebar>
      <Pane />
    </SplitView>
  )
}`;

const RESIZE_CODE = `import { SplitView, SplitViewSidebar, SplitViewDetail } from '@brett_lamy/ui'

// SplitView measures its own box, so the frame is all it needs. Drag the handle:
// regular tiles both columns, medium floats the list over the editor, compact
// stacks them — the selected note and the list's scroll position survive every step.
export default function Resizable({ width }: { width: number }) {
  return (
    <div style={{ width, height: 480 }}>
      <SplitView breakpoints={{ medium: 470, regular: 620 }} defaultCompactColumn="sidebar">
        <SplitViewSidebar width={240}>…</SplitViewSidebar>
        <SplitViewDetail>…</SplitViewDetail>
      </SplitView>
    </div>
  )
}`;

export const SPLIT_VIEW_LIVE: Record<string, LiveSpec> = {
  splitMail: {
    title: 'SplitView · Mail, three columns', theme: 'bl', h: 600,
    variants: SIZES.map(({ id, label }) => ({ id, label })), variantsWidth: 280,
    code: MAIL_CODE,
    Render: function SplitMailLive({ variant }) {
      const size = sizeOf(variant);
      return <div>
        <Scaled width={size.width} height={size.id === 'compact' ? 700 : 600}>
          <SplitViewMailDemo />
        </Scaled>
        <Caption>{size.id === 'regular' ? 'Regular: mailboxes, list and message tiled. The sidebar button slides the mailboxes away.'
          : size.id === 'medium' ? 'Medium: list and message tile; the sidebar button floats the mailboxes over them.'
          : 'Compact: one column at a time. Pick a row to push; back, Esc or an edge swipe pops.'}</Caption>
      </div>;
    },
  },
  splitNotes: {
    title: 'SplitView · Notes, two columns', theme: 'bl', h: 540,
    variants: [{ id: 'regular', label: 'Regular' }, { id: 'compact', label: 'Compact' }], variantsWidth: 200,
    code: NOTES_CODE,
    Render: function SplitNotesLive({ variant }) {
      const compact = variant === 'compact';
      return <div>
        <Scaled width={compact ? 390 : 1080} height={compact ? 640 : 560}>
          <SplitViewNotesDemo />
        </Scaled>
        <Caption>{compact ? 'Compact starts on the list; the note pushes in from the trailing edge.' : 'Hide the list for a full-width editor — the editor morphs, it never re-renders into a new place.'}</Caption>
      </div>;
    },
  },
  splitSettings: {
    title: 'SplitView · Settings, sidebar behaviours', theme: 'bl', h: 560,
    variants: [{ id: 'tile', label: 'Tile' }, { id: 'overlay', label: 'Overlay' }, { id: 'displace', label: 'Displace' }], variantsWidth: 260,
    code: settingsCode('tile'),
    codeFor: settingsCode,
    Render: function SplitSettingsLive({ variant }) {
      const tile = variant === 'tile' || !variant;
      const [open, setOpen] = useState(true);
      useEffect(() => { setOpen(true); }, [variant]);
      return <div>
        <Scaled width={tile ? 1060 : 820} height={560}>
          {tile
            ? <SplitViewSettingsDemo />
            : <SplitViewSettingsDemo sidebarBehavior={variant as 'overlay' | 'displace'} sidebarVisible={open} onSidebarVisibleChange={setOpen} />}
        </Scaled>
        <Caption>{tile ? 'Tile (regular): the sidebar takes its own column.'
          : variant === 'overlay' ? 'Overlay (medium): the sidebar floats above a scrim. Tap outside or press Esc.'
          : 'Displace (medium): the sidebar pushes the detail aside and dims it.'}</Caption>
      </div>;
    },
  },
  splitResize: {
    title: 'SplitView · drag to resize', theme: 'bl', h: 540,
    code: RESIZE_CODE,
    Render: function SplitResizeLive() {
      const bp = { medium: 470, regular: 620 };
      return <SplitViewResizableDemo initial={2000} min={320} height={480} breakpoints={bp}>
        <SplitViewNotesDemo breakpoints={bp} listWidth={240} />
      </SplitViewResizableDemo>;
    },
  },
};
