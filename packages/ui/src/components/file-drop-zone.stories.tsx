import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { FileDropZone } from '@/components/ui/file-upload';
import { Pad } from '../stories/frame';

/* The zone on its own (no list, no state; `onFiles` gives it a FileInput of its own): idle, drag-over (a real
   dragenter, so `data-dragging` is the drop zone's own), disabled, invalid and compact. */

const inPad = (dark?: boolean): Decorator[] => [(Story) => <Pad w={440} dark={dark}><Story /></Pad>];

const meta: Meta<typeof FileDropZone> = {
  title: 'Molecules/FileDropZone',
  component: FileDropZone,
  args: { rules: { accept: ['image/*'], maxSize: 5_000_000 }, onFiles: () => undefined },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'compact'] },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof FileDropZone>;
const light = { decorators: inPad() } satisfies Story;

export const Idle: Story = { ...light };

export const DragOver: Story = {
  ...light,
  play: ({ canvasElement }) => {
    const zone = canvasElement.querySelector('[data-slot=file-input-dropzone]');
    if (!zone) return;
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'photo.png', { type: 'image/png' }));
    for (const type of ['dragenter', 'dragover']) zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  },
};

export const Disabled: Story = { ...light, args: { disabled: true } };

export const Invalid: Story = { ...light, args: { invalid: true, error: 'Add at least one photo to continue.' } };

export const Compact: Story = { ...light, args: { size: 'compact', icon: 'paperclip', title: 'Add attachments' } };

export const Folders: Story = { ...light, args: { directory: true, title: 'Drop a folder here', icon: 'folder', rules: {} } };

export const Dark: Story = {
  decorators: inPad(true),
};
