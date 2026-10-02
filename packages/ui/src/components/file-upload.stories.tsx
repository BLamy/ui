import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileDropZone, FileItem, FileList, FileUpload, FileUploadButton, type FileUploadProps } from '@/components/ui/file-upload';
import type { UploadFile } from '@/lib/file-upload';
import { Pad } from '../stories/frame';

/* Seeded states for the visual-regression suite: files are listed with fixed statuses (no `upload` function is
   given, so nothing moves), and "drag-over" is the real thing: the play function sends dragenter / dragover with a
   DataTransfer, so react-aria sets `data-drop-target` itself. */

const meta: Meta<typeof FileUpload> = {
  title: 'Molecules/FileUpload',
  component: FileUpload,
};
export default meta;
type Story = StoryObj<typeof FileUpload>;

const gradient = (a: string, b: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/></svg>`;

/** A File whose reported size is `size` (so a "2.4 MB" row doesn't need 2.4 MB of memory). */
function fakeFile(name: string, size: number, type: string, body: BlobPart = ''): File {
  const file = new File([body], name, { type, lastModified: 1 });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

let n = 0;
const item = (file: File, status: UploadFile['status'], extra: Partial<UploadFile> = {}): UploadFile => ({
  id: `seed-${++n}`, file, path: file.name, status, progress: status === 'done' ? 1 : 0, ...extra,
});

const seedFiles = {
  uploading: () => [
    item(fakeFile('IMG_2841.jpg', 2.4 * 1024 * 1024, 'image/svg+xml', gradient('#f97316', '#db2777')), 'uploading', { progress: 0.42 }),
    item(fakeFile('Quarterly report.pdf', 860 * 1024, 'application/pdf'), 'uploading', { progress: 0.8 }),
    item(fakeFile('notes.md', 3 * 1024, 'text/markdown'), 'queued'),
  ],
  mixed: () => [
    item(fakeFile('IMG_2841.jpg', 2.4 * 1024 * 1024, 'image/svg+xml', gradient('#0ea5e9', '#6366f1')), 'done'),
    item(fakeFile('Quarterly report.pdf', 860 * 1024, 'application/pdf'), 'error', { error: 'Connection lost' }),
    item(fakeFile('a-very-long-file-name-that-keeps-going-and-going-until-it-has-to-truncate-somewhere.mov', 48 * 1024 * 1024, 'video/quicktime'), 'done'),
  ],
  rejected: () => [
    item(fakeFile('archive.zip', 4 * 1024 * 1024, 'application/zip'), 'rejected', { reason: 'type', error: 'Unsupported file type. Accepted: Images and PDFs.' }),
    item(fakeFile('huge.png', 12 * 1024 * 1024, 'image/png'), 'rejected', { reason: 'too-large', error: 'Larger than the 5 MB limit.' }),
    item(fakeFile('ok.png', 120 * 1024, 'image/svg+xml', gradient('#22c55e', '#0d9488')), 'queued'),
  ],
};

/** FileUpload seeded with a list. */
function Seeded({ seed, dark, children, ...props }: { seed: () => UploadFile[]; dark?: boolean } & Omit<FileUploadProps, 'defaultFiles'>) {
  const [files] = useState(seed);
  return (
    <Pad w={440} dark={dark}>
      <FileUpload defaultFiles={files} {...props}>{children}</FileUpload>
    </Pad>
  );
}

/** Sends dragenter and dragover to the zone with a real DataTransfer, so the drag-over state is react-aria's own. */
async function dragOver({ canvasElement }: { canvasElement: HTMLElement }) {
  const zone = canvasElement.querySelector('[data-slot=file-drop-zone]');
  if (!zone) return;
  const dt = new DataTransfer();
  // A script-built DataTransfer reports effectAllowed "none", which react-aria reads as "can't drop"; a real drag carries the source's.
  Object.defineProperty(dt, 'effectAllowed', { value: 'all' });
  dt.items.add(new File(['x'], 'photo.png', { type: 'image/png' }));
  const fire = (type: string) => zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  fire('dragenter');
  fire('dragover');
}

export const Idle: Story = {
  render: (args) => (
    <Pad w={440}><FileUpload {...args} /></Pad>
  ),
  args: { accept: ['image/*', 'application/pdf'], maxSize: 5 * 1024 * 1024, maxFiles: 5 },
};

export const DragOver: Story = {
  ...Idle,
  play: dragOver,
};

export const Uploading: Story = {
  render: (args) => <Seeded seed={seedFiles.uploading} {...args} />,
  args: { maxSize: 25 * 1024 * 1024 },
};

export const DoneAndError: Story = {
  render: (args) => <Seeded seed={seedFiles.mixed} {...args} />,
};

export const Rejected: Story = {
  render: (args) => <Seeded seed={seedFiles.rejected} {...args} />,
  args: { accept: ['image/*', 'application/pdf'], maxSize: 5 * 1024 * 1024 },
};

export const Dark: Story = {
  render: (args) => <Seeded dark seed={seedFiles.mixed} {...args} />,
};

export const ButtonOnly: Story = {
  render: () => (
    <Pad w={440}>
      <FileUpload>
        <FileUploadButton>Upload files</FileUploadButton>
        <FileList />
      </FileUpload>
    </Pad>
  ),
};

export const CustomRow: Story = {
  render: () => {
    const [files] = useState(seedFiles.mixed);
    return (
      <Pad w={440}>
        <FileUpload defaultFiles={files}>
          <FileDropZone size="compact" title="Add attachments" icon="paperclip" />
          <FileList>{(f) => <FileItem item={f} className="rounded-ctl" />}</FileList>
        </FileUpload>
      </Pad>
    );
  },
};
