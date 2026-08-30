import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer, AnnotateLightbox } from './composer';
import { WorkbenchTheme } from './theme';
import '../styles.css';

const meta: Meta<typeof Composer> = {
  title: 'Molecules/Workbench Composer',
  component: Composer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <WorkbenchTheme style={{ minHeight: 420, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
          <Story />
        </div>
      </WorkbenchTheme>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Composer>;

export const Default: Story = {
  args: { onSend: () => {}, wide: false },
};

export const Wide: Story = {
  args: { onSend: () => {}, wide: true },
};

export const Streaming: Story = {
  args: { onSend: () => {}, streaming: true, onStop: () => {} },
};

function LiveDemo() {
  const [streaming, setStreaming] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div>
      <Composer
        wide
        onSend={() => {
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
    </div>
  );
}
export const Interactive: Story = {
  render: () => <LiveDemo />,
};

/* the annotate lightbox that opens when a pasted attachment is clicked — pass a drawing
   surface (e.g. PencilCanvas from @touchkit/pencilkit) as `canvas`; without one it shows
   the loading placeholder the prototype rendered before PencilKit arrived. */
const SAMPLE_IMG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect width="560" height="340" fill="#1C1C23"/>' +
      '<rect x="24" y="24" width="512" height="60" rx="10" fill="#26262E"/>' +
      '<rect x="24" y="104" width="330" height="212" rx="10" fill="#101015"/>' +
      '<rect x="374" y="104" width="162" height="212" rx="10" fill="#26262E"/>' +
      '<text x="44" y="60" fill="#9C9CA6" font-family="ui-monospace,Menlo,monospace" font-size="15">pasted screenshot — click Save to flatten</text></svg>'
  );
export const Annotate: Story = {
  render: () => <AnnotateLightbox src={SAMPLE_IMG} onClose={() => {}} onSave={() => {}} />,
};
