// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDropZone, FileItem, FileList, FileUpload, FileUploadButton } from '@/components/ui/file-upload';
import { useFileUpload, type UploadContext, type UploadFile } from '@/lib/file-upload';

const file = (name: string, size = 2048, type = 'text/plain') => new File([new Uint8Array(size)], name, { type, lastModified: 1 });

function manual() {
  const calls: { file: File; ctx: UploadContext; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const upload = vi.fn((f: File, ctx: UploadContext) => new Promise<void>((resolve, reject) => calls.push({ file: f, ctx, resolve, reject })));
  return { calls, upload };
}

/** Chooses files the way a browser does: the FileTrigger's hidden input fires `change`. */
function choose(container: HTMLElement, ...files: File[]) {
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}
/** react-aria buttons act on press events (pointer or keyboard), not a bare click. */
function press(el: HTMLElement) {
  act(() => el.focus());
  fireEvent.keyDown(el, { key: 'Enter' });
  fireEvent.keyUp(el, { key: 'Enter' });
}
const settle = () => act(async () => { await Promise.resolve(); });
const announce = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });
  return (screen.getByRole('status').textContent ?? '').trim();
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FileUpload', () => {
  it('renders the zone with its hint and a Browse button, and an empty list renders nothing', () => {
    const { container } = render(<FileUpload accept={['image/*']} maxSize={5 * 1024 * 1024} maxFiles={3} />);
    const zone = container.querySelector('[data-slot=file-drop-zone]') as HTMLElement;
    expect(zone).toBeTruthy();
    expect(within(zone).getByText('Drag files here')).toBeTruthy();
    expect(within(zone).getByText('Images · up to 5 MB each · up to 3 files')).toBeTruthy();
    expect(within(zone).getByRole('button', { name: 'Browse files' })).toBeTruthy();
    expect(container.querySelector('[data-slot=file-list]')).toBeNull();
    expect((container.querySelector('input[type=file]') as HTMLInputElement).accept).toBe('image/*');
    expect((container.querySelector('input[type=file]') as HTMLInputElement).multiple).toBe(true);
  });

  it('a single-file upload (maxFiles 1) makes a single-file chooser', () => {
    const { container } = render(<FileUpload maxFiles={1} />);
    expect((container.querySelector('input[type=file]') as HTMLInputElement).multiple).toBe(false);
  });

  it('lists chosen files as labelled groups with name and size, then announces them once', async () => {
    const { container } = render(<FileUpload />);
    choose(container, file('a.txt', 2048), file('b.txt', 10));
    const list = screen.getByRole('list', { name: 'Files' });
    const a = within(list).getByRole('group', { name: 'a.txt' });
    expect(a.textContent).toContain('2 KB');
    expect(a.textContent).toContain('Waiting');
    expect(within(list).getByRole('group', { name: 'b.txt' })).toBeTruthy();
    expect(await announce()).toBe('2 files added.');
  });

  it('shows rejected files with the reason and dismisses them, announcing both', async () => {
    const { container } = render(<FileUpload accept={['image/*']} />);
    choose(container, file('notes.txt'));
    const row = screen.getByRole('group', { name: 'notes.txt' });
    expect(row.getAttribute('data-status')).toBe('rejected');
    expect(row.textContent).toContain('Not added');
    expect(row.textContent).toContain('Unsupported file type. Accepted: Images.');
    expect(await announce()).toBe('notes.txt rejected. Unsupported file type. Accepted: Images.');
    press(within(row).getByRole('button', { name: 'Dismiss notes.txt' }));
    expect(screen.queryByRole('group', { name: 'notes.txt' })).toBeNull();
    // With no neighbor left, focus goes back to the zone's button.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Browse files' }));
    expect(await announce()).toBe('notes.txt removed.');
  });

  it('moves focus to the next row when one is removed', () => {
    const { container } = render(<FileUpload />);
    choose(container, file('a.txt'), file('b.txt'), file('c.txt'));
    press(within(screen.getByRole('group', { name: 'b.txt' })).getByRole('button', { name: 'Remove b.txt' }));
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: 'c.txt' })).getByRole('button', { name: 'Remove c.txt' }));
    press(within(screen.getByRole('group', { name: 'c.txt' })).getByRole('button', { name: 'Remove c.txt' }));
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: 'a.txt' })).getByRole('button', { name: 'Remove a.txt' }));
  });

  it('sends files, shows a progressbar while uploading and "Uploaded" after', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} />);
    choose(container, file('a.txt'));
    await settle();
    const row = screen.getByRole('group', { name: 'a.txt' });
    expect(row.getAttribute('data-status')).toBe('uploading');
    expect(within(row).getByRole('progressbar', { name: 'Uploading a.txt' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Cancel upload of a.txt' })).toBeTruthy();
    act(() => calls[0].ctx.onProgress(0.5));
    expect(within(row).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(row.textContent).toContain('Uploading 50%');
    // Progress ticks are not announced.
    expect(await announce()).toBe('1 file added.');
    await act(async () => calls[0].resolve());
    expect(row.getAttribute('data-status')).toBe('done');
    expect(row.textContent).toContain('Uploaded');
    expect(within(row).queryByRole('progressbar')).toBeNull();
    expect(await announce()).toBe('a.txt uploaded.');
  });

  it('shows the failure with a Retry button, announced as failed', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} />);
    choose(container, file('a.txt'));
    await settle();
    await act(async () => calls[0].reject(new Error('Connection lost')));
    const row = screen.getByRole('group', { name: 'a.txt' });
    expect(row.getAttribute('data-status')).toBe('error');
    expect(row.textContent).toContain('Upload failed');
    expect(row.textContent).toContain('Connection lost');
    expect(within(row).getByRole('button', { name: 'Retry a.txt' })).toBeTruthy();
    expect(await announce()).toBe('1 file added. a.txt failed to upload.');
  });

  it('batches a burst of events into one announcement', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} concurrency={5} />);
    choose(container, file('a'), file('b'), file('c'));
    await settle();
    await act(async () => { calls.forEach((c) => c.resolve()); });
    expect(await announce()).toBe('3 files added. 3 files uploaded.');
  });

  it('is disabled as a whole', () => {
    const { container } = render(<FileUpload disabled />);
    expect((screen.getByRole('button', { name: 'Browse files' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-slot=file-drop-zone]')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('children can be a function of the context, and a zone can take over its contents', () => {
    render(
      <FileUpload>
        {(api) => (
          <FileDropZone>{(state) => <p>{`files: ${api.files.length}, over: ${String(state.isDropTarget)}`}</p>}</FileDropZone>
        )}
      </FileUpload>,
    );
    expect(screen.getByText('files: 0, over: false')).toBeTruthy();
  });

  it('is controlled with files + onFilesChange', () => {
    const seen: UploadFile[][] = [];
    const { container } = render(<FileUpload files={[]} onFilesChange={(files) => seen.push(files)} />);
    choose(container, file('a.txt'));
    expect(seen[0].map((f) => f.file.name)).toEqual(['a.txt']);
    // The parent did not take the change, so the list stays empty.
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('takes a useFileUpload from outside, so the page can drive it', async () => {
    const { upload, calls } = manual();
    let api!: ReturnType<typeof useFileUpload>;
    function Page() {
      api = useFileUpload({ upload, autoUpload: false });
      return <FileUpload state={api} />;
    }
    const { container } = render(<Page />);
    choose(container, file('a.txt'));
    await settle();
    expect(calls).toHaveLength(0);
    act(() => api.uploadAll());
    await settle();
    expect(calls).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'a.txt' }).getAttribute('data-status')).toBe('uploading');
  });

  it('shows the zone invalid with its message and an icon, not just a color', () => {
    render(<FileDropZone isInvalid error="Add at least one file." />);
    const msg = screen.getByText('Add at least one file.');
    expect(msg.querySelector('svg')).toBeTruthy();
    expect(document.querySelector('[data-slot=file-drop-zone]')?.hasAttribute('data-invalid')).toBe(true);
  });

  it('merges className last and keeps data-slot', () => {
    const { container } = render(<FileUpload className="custom-root"><FileDropZone className="custom-zone p-0" /></FileUpload>);
    expect(container.querySelector('[data-slot=file-upload]')?.classList.contains('custom-root')).toBe(true);
    const zone = container.querySelector('[data-slot=file-drop-zone]') as HTMLElement;
    expect(zone.classList.contains('custom-zone')).toBe(true);
    expect(zone.classList.contains('p-6')).toBe(false); // tailwind-merge: the caller's p-0 wins
  });
});

describe('parts used alone', () => {
  it('FileUploadButton opens the chooser and hands files to onFiles with their paths', () => {
    const onFiles = vi.fn();
    const { container } = render(<FileUploadButton onFiles={onFiles} accept={['.pdf']}>Attach</FileUploadButton>);
    expect(screen.getByRole('button', { name: 'Attach' })).toBeTruthy();
    expect((container.querySelector('input[type=file]') as HTMLInputElement).accept).toBe('.pdf');
    choose(container, file('a.pdf'));
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0][0].map((e: { path: string }) => e.path)).toEqual(['a.pdf']);
    expect(onFiles.mock.calls[0][1]).toMatchObject({ source: 'browse', truncated: false, skippedFolders: 0 });
  });

  it('FileDropZone takes onFiles and passes acceptDirectory and defaultCamera to the input', () => {
    const { container } = render(<FileDropZone acceptDirectory defaultCamera="environment" onFiles={() => undefined} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.hasAttribute('webkitdirectory')).toBe(true);
    expect(input.getAttribute('capture')).toBe('environment');
  });

  it('FileItem renders a given UploadFile with its own handlers, and FileList renders rows', () => {
    const item: UploadFile = { id: '1', file: file('x.png', 100, 'image/png'), path: 'dir/x.png', status: 'error', progress: 0, error: 'Nope' };
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(<FileList files={[item]}>{(it) => <FileItem item={it} onRetry={onRetry} onRemove={onRemove} />}</FileList>);
    const group = screen.getByRole('group', { name: 'x.png' });
    expect(group.getAttribute('data-file-id')).toBe('1');
    expect(group.textContent).toContain('Nope');
    expect(screen.getByRole('list', { name: 'Files' })).toBeTruthy();
  });

  it('FileItem with no handlers and no FileUpload shows no actions', () => {
    const item: UploadFile = { id: '1', file: file('x.txt'), path: 'x.txt', status: 'done', progress: 1 };
    render(<FileItem item={item} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
