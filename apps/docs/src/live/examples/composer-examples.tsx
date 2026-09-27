/* Composer page — more compositions of the same parts, each showing its motion: the send button morphing
   into stop, thumbnails popping in and out, the annotator zooming out of a thumbnail and back, a custom
   inline-start addon. Registered in live-core.tsx. */
import { useEffect, useRef, useState } from 'react';
import {
  Composer, ComposerAddon, ComposerAttach, ComposerAttachments, ComposerButton, ComposerCard, ComposerExpand,
  ComposerFooter, ComposerInput, ComposerSelect, ComposerSend, ComposerSpacer, WIcon, type ComposerAttachment,
} from '@brett_lamy/ui';
import type { LiveSpec } from '../frame';

/** Replies for a few seconds after each send, so the send ↔ stop morph can be seen. */
function useFakeReply(ms = 2200) {
  const [streaming, setStreaming] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return {
    streaming,
    onSubmit: () => {
      setStreaming(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setStreaming(false), ms);
    },
    onStop: () => {
      if (t.current) clearTimeout(t.current);
      setStreaming(false);
    },
  };
}

const SHOT =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect width="560" height="340" fill="#1C1C23"/>' +
      '<rect x="24" y="24" width="512" height="60" rx="10" fill="#26262E"/><rect x="24" y="104" width="330" height="212" rx="10" fill="#101015"/>' +
      '<rect x="374" y="104" width="162" height="212" rx="10" fill="#0A84FF"/>' +
      '<text x="44" y="60" fill="#9C9CA6" font-family="ui-monospace,Menlo,monospace" font-size="15">pasted screenshot</text></svg>',
  );
const SEED: ComposerAttachment[] = [{ id: 'shot-1', name: 'header.png', src: SHOT, size: 84 * 1024, type: 'image/svg+xml' }];

const minimalCode = `import { Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend } from '@brett_lamy/ui'

// The smallest composer: a card, the editor and a send button. While \`streaming\`, the send button
// morphs into the stop control — the same button, its fill and glyph changing.
export default function Minimal() {
  const [streaming, setStreaming] = useState(false)
  return (
    <Composer onSubmit={reply} streaming={streaming} onStop={stop}>
      <ComposerCard>
        <ComposerInput placeholder="Message" />
        <ComposerFooter>
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  )
}`;

const chipCode = `import {
  Composer, ComposerCard, ComposerAttachments, ComposerInput, ComposerExpand,
  ComposerFooter, ComposerAttach, ComposerSpacer, ComposerSend,
} from '@brett_lamy/ui'

// Paste or attach an image: a chip lands at the caret and a thumbnail pops into the strip.
// Press either — the PencilKit annotator (the default) zooms out of it; Save flattens the strokes and lands back in it.
// (Swap it with <Composer annotator={MyAnnotator}> or a <ComposerAnnotatorProvider>; annotator={null} opts out.)
export default function ImageChips() {
  return (
    <Composer defaultAttachments={seed} defaultValue="Fix this overlap ![header.png](attachment:shot-1)">
      <ComposerCard>
        <ComposerExpand />
        <ComposerAttachments />
        <ComposerInput placeholder="Paste an image" />
        <ComposerFooter>
          <ComposerAttach />
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  )
}`;

const addonCode = `import {
  Composer, ComposerCard, ComposerAddon, ComposerButton, ComposerInput,
  ComposerSelect, ComposerSend, WIcon,
} from '@brett_lamy/ui'

// A one-row messenger: a "+" column before the editor (inline-start), a tone picker and send after it
// (inline-end). Addons order themselves, so the markup order doesn't matter.
export default function Messenger() {
  return (
    <Composer onSubmit={reply} streaming={streaming} onStop={stop}>
      <ComposerCard size="lg">
        <ComposerAddon align="inline-start">
          <ComposerButton aria-label="Add"><WIcon name="plus" /></ComposerButton>
        </ComposerAddon>
        <ComposerInput placeholder="Reply to #design" />
        <ComposerAddon align="inline-end">
          <ComposerSelect aria-label="Tone" options={tones} />
          <ComposerSend />
        </ComposerAddon>
      </ComposerCard>
    </Composer>
  )
}`;

const TONES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'concise', label: 'Concise' },
];

export const COMPOSER_EXAMPLES: Record<string, LiveSpec> = {
  composer_minimal: {
    title: 'Composer · minimal card + send', theme: 'wb', h: 160,
    code: minimalCode,
    Render: function MinimalLive() {
      const reply = useFakeReply();
      return (
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 0' }}>
          <Composer onSubmit={reply.onSubmit} streaming={reply.streaming} onStop={reply.onStop}>
            <ComposerCard>
              <ComposerInput placeholder="Message — press Enter to watch send turn into stop" />
              <ComposerFooter>
                <ComposerSpacer />
                <ComposerSend />
              </ComposerFooter>
            </ComposerCard>
          </Composer>
        </div>
      );
    },
  },
  composer_chips: {
    title: 'Composer · image chips and the annotator', theme: 'wb', h: 260,
    code: chipCode,
    Render: function ChipsLive() {
      return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 0' }}>
          <Composer defaultAttachments={SEED} defaultValue="The header overlaps the sidebar here ![header.png](attachment:shot-1) — can you fix the z-index?">
            <ComposerCard>
              <ComposerExpand />
              <ComposerAttachments />
              <ComposerInput placeholder="Paste an image" />
              <ComposerFooter>
                <ComposerAttach />
                <ComposerSpacer />
                <ComposerSend />
              </ComposerFooter>
            </ComposerCard>
          </Composer>
          <p style={{ fontSize: 12, color: 'var(--wb-label2)', textAlign: 'center', margin: '12px 0 0' }}>
            Press the thumbnail or the chip: the image zooms out of it. ✕ removes it — its neighbours slide over and the strip folds away.
          </p>
        </div>
      );
    },
  },
  composer_addon: {
    title: 'Composer · custom composition (inline-start addon)', theme: 'wb', h: 170,
    code: addonCode,
    Render: function AddonLive() {
      const reply = useFakeReply(1800);
      return (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '36px 0' }}>
          <Composer onSubmit={reply.onSubmit} streaming={reply.streaming} onStop={reply.onStop}>
            <ComposerCard size="lg" className="flex-nowrap">
              <ComposerAddon align="inline-start" className="self-center pt-0 pl-2">
                <ComposerButton aria-label="Add" className="rounded-[50%]">
                  <WIcon name="plus" size={16} sw={2.2} />
                </ComposerButton>
              </ComposerAddon>
              <ComposerInput placeholder="Reply to #design" slashMenu={false} />
              <ComposerAddon align="inline-end" className="self-center pt-0 pr-2">
                <ComposerSelect aria-label="Tone" options={TONES} />
                <ComposerSend stopVariant="solid" />
              </ComposerAddon>
            </ComposerCard>
          </Composer>
        </div>
      );
    },
  },
};
