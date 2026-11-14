import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { FileUploadDropzone } from '@/components/ui/file-upload';
import { Pad } from '../stories/frame';

/* The zone on its own (no list, no state; `onFiles` gives it a FileInput of its own): idle, drag-over (a real
   dragenter, so `data-dragging` is the drop zone's own), disabled, invalid (from a Field) and horizontal. */

const inPad = (dark?: boolean): Decorator[] => [(Story) => <Pad w={440} dark={dark}><Story /></Pad>];

const meta: Meta<typeof FileUploadDropzone> = {
  title: 'Molecules/FileUploadDropzone',
  component: FileUploadDropzone,
  args: { rules: { accept: ['image/*'], maxSize: 5_000_000 }, onFiles: () => undefined },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof FileUploadDropzone>;
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

/** Invalid comes from the Field around it: the zone's border turns red and the FieldError says why. */
export const Invalid: Story = {
  ...light,
  render: (args) => (
    <Field invalid>
      <FieldLabel>Photos</FieldLabel>
      <FileUploadDropzone {...args} />
      <FieldError>Add at least one photo to continue.</FieldError>
    </Field>
  ),
};

export const Horizontal: Story = { ...light, args: { orientation: 'horizontal', icon: 'paperclip', title: 'Add attachments' } };

export const Folders: Story = { ...light, args: { directory: true, title: 'Drop a folder here', icon: 'folder', rules: {} } };

export const Dark: Story = {
  decorators: inPad(true),
};
