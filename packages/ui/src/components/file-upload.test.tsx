// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileDropZone, FileItem, FileList, FileUpload, FileUploadButton } from '@/components/ui/file-upload';
import type { UploadContext, UploadFile } from '@/lib/file-upload-model';
import { createFileUploadController, type FileUploadValueChangeDetails } from '@/lib/file-upload-primitive';
import { useFileUpload } from '@/lib/use-file-upload';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

const file = (name: string, size = 2048, type = 'text/plain') => new File([new Uint8Array(size)], name, { type, lastModified: 1 });

function manual() {
  const calls: { file: File; ctx: UploadContext; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const upload = vi.fn((f: File, ctx: UploadContext) => new Promise<void>((resolve, reject) => calls.push({ file: f, ctx, resolve, reject })));
  return { calls, upload };
}

/** Chooses files the way a browser does: FileInput's hidden input fires `change`. */
function choose(container: HTMLElement, ...files: File[]) {
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** What UI SDK's polite live region says once its announcements have settled. */
const announced = async () => {
  await wait(450);
  return (document.querySelector('[data-ui-sdk-announcer=""]')?.textContent ?? '').trim();
};
const rows = () => screen.queryAllByRole('listitem').filter((el) => el.matches('[data-slot=file-input-item]'));

afterEach(() => cleanup());

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

describe('FileUpload', () => {
  it('renders the zone with its hint and a Browse button, and an empty list renders nothing', () => {
    const { container } = render(<FileUpload accept={['image/*']} maxSize={5_000_000} maxFiles={3} />);
    const zone = container.querySelector('[data-slot=file-input-dropzone]') as HTMLElement;
    expect(within(zone).getByText('Drag files here')).toBeTruthy();
    const hint = within(zone).getByText('Images · up to 5 MB each · up to 3 files');
    const browse = within(zone).getByRole('button', { name: 'Browse files' });
    expect(browse.getAttribute('aria-describedby')).toContain(hint.id);
    expect(container.querySelector('[data-slot=file-list]')).toBeNull();
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.accept).toBe('image/*');
    expect(input.multiple).toBe(true);
  });

  it('a single-file upload (maxFiles 1) makes a single-file chooser, and a new file replaces the old', async () => {
    const { container } = render(<FileUpload maxFiles={1} />);
    expect((container.querySelector('input[type=file]') as HTMLInputElement).multiple).toBe(false);
    choose(container, file('a.txt'));
    choose(container, file('b.txt'));
    await wait();
    expect(rows().map((r) => r.textContent?.includes('b.txt'))).toEqual([true]);
  });

  it('lists chosen files with name and size as one list with one Tab stop, announced once', async () => {
    const { container } = render(<FileUpload />);
    choose(container, file('a.txt', 2048), file('b.txt', 10));
    await wait();
    const list = screen.getByRole('list', { name: 'Files' });
    const [a, b] = within(list).getAllByRole('listitem');
    expect(a.textContent).toContain('a.txt');
    expect(a.textContent).toContain('2 kB');
    expect(a.textContent).toContain('Waiting');
    expect(a.getAttribute('data-status')).toBe('queued');
    expect([a.tabIndex, b.tabIndex]).toEqual([0, -1]);
    expect(await announced()).toBe('2 files added.');
  });

  it('moves between rows with the arrow keys and removes the focused one with Delete', async () => {
    const onValueChange = vi.fn();
    const { container } = render(<FileUpload onValueChange={onValueChange} />);
    choose(container, file('a.txt'), file('b.txt'), file('c.txt'));
    await wait();
    const [a, b] = rows();
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b, { key: 'Delete' });
    await wait();
    expect(rows().map((r) => r.querySelector('[title]')?.textContent)).toEqual(['a.txt', 'c.txt']);
    expect(document.activeElement).toBe(rows()[1]);
    expect(onValueChange.mock.lastCall?.[0].map((f: UploadFile) => f.file.name)).toEqual(['a.txt', 'c.txt']);
    expect(onValueChange.mock.lastCall?.[1]).toMatchObject({ reason: 'remove-press' });
  });

  it('a canceled change leaves the list as it was: Delete on a row the host refuses keeps it', async () => {
    const { container } = render(
      <FileUpload onValueChange={(_files, details) => { if (details.reason === 'remove-press') details.cancel(); }} />,
    );
    choose(container, file('a.txt'), file('b.txt'));
    await wait();
    const [a] = rows();
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'Delete' });
    await wait();
    expect(rows()).toHaveLength(2);
  });

  it('names the remove button for its file and keeps it out of the Tab order', async () => {
    const { container } = render(<FileUpload />);
    choose(container, file('a.txt'));
    await wait();
    const remove = screen.getByRole('button', { name: 'Remove a.txt' });
    expect(remove.tabIndex).toBe(-1);
    fireEvent.click(remove);
    await wait();
    expect(screen.queryByRole('list', { name: 'Files' })).toBeNull();
  });

  it('shows rejected files with the reason and dismisses them, announcing the rejection', async () => {
    const onValueChange = vi.fn();
    const { container } = render(<FileUpload accept={['image/*']} onValueChange={onValueChange} />);
    choose(container, file('notes.txt'));
    await wait();
    const row = screen.getByRole('group', { name: 'notes.txt' });
    expect(row.getAttribute('data-status')).toBe('rejected');
    expect(row.textContent).toContain('Not added');
    expect(row.textContent).toContain('Unsupported file type. Accepted: Images.');
    expect(screen.getByRole('list', { name: 'Not added' })).toBeTruthy();
    expect(await announced()).toBe('notes.txt rejected. Unsupported file type. Accepted: Images.');
    fireEvent.click(within(row).getByRole('button', { name: 'Dismiss notes.txt' }));
    await wait();
    expect(screen.queryByRole('group', { name: 'notes.txt' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Browse files' }));
    expect(onValueChange.mock.calls.map(([, d]) => d.reason)).toEqual(['reject', 'remove-press']);
    expect(onValueChange.mock.lastCall?.[1].removed.map((f: UploadFile) => f.file.name)).toEqual(['notes.txt']);
  });

  it('turns away a file it already holds as a duplicate, and counts only listed files against maxFiles', async () => {
    const { container } = render(<FileUpload maxFiles={2} />);
    choose(container, file('a.txt'));
    choose(container, file('a.txt'), file('b.txt'), file('c.txt'));
    await wait();
    expect(rows()).toHaveLength(2);
    const reasons = screen.getAllByRole('group').map((g) => g.textContent);
    expect(reasons[0]).toContain('Already added.');
    expect(reasons[1]).toContain('Only 2 files are allowed.');
  });

  it('sends files, shows a progressbar while uploading and "Uploaded" after', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} />);
    choose(container, file('a.txt'));
    await wait();
    const row = () => rows()[0];
    expect(row().getAttribute('data-status')).toBe('uploading');
    expect(within(row()).getByRole('progressbar', { name: 'Uploading a.txt' })).toBeTruthy();
    expect(within(row()).getByRole('button', { name: 'Cancel upload of a.txt' })).toBeTruthy();
    act(() => calls[0].ctx.onProgress(0.5));
    expect(within(row()).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(row().textContent).toContain('Uploading 50%');
    expect(await announced()).toBe('1 file added.');
    await act(async () => calls[0].resolve());
    expect(row().getAttribute('data-status')).toBe('done');
    expect(row().textContent).toContain('Uploaded');
    expect(within(row()).queryByRole('progressbar')).toBeNull();
    expect(await announced()).toBe('a.txt uploaded.');
  });

  it('shows the failure with a Retry button, announced as failed, and retries', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} />);
    choose(container, file('a.txt'));
    await wait();
    await act(async () => calls[0].reject(new Error('Connection lost')));
    const row = rows()[0];
    expect(row.getAttribute('data-status')).toBe('error');
    expect(row.textContent).toContain('Upload failed');
    expect(row.textContent).toContain('Connection lost');
    expect(await announced()).toBe('a.txt failed to upload.');
    fireEvent.click(within(row).getByRole('button', { name: 'Retry a.txt' }));
    await wait();
    expect(calls).toHaveLength(2);
  });

  it('batches uploads that finish together into one announcement', async () => {
    const { upload, calls } = manual();
    const { container } = render(<FileUpload upload={upload} concurrency={5} />);
    choose(container, file('a'), file('b'), file('c'));
    await wait();
    await act(async () => { calls.forEach((c) => c.resolve()); });
    expect(await announced()).toBe('3 files uploaded.');
  });

  it('is disabled as a whole', () => {
    const { container } = render(<FileUpload disabled />);
    expect((screen.getByRole('button', { name: 'Browse files' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-slot=file-input-dropzone]')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('children can be a function of the context, and a zone can take over its contents', () => {
    render(
      <FileUpload>
        {(api) => <FileDropZone>{(state) => <p>{`files: ${api.files.length}, over: ${String(state.dragging)}`}</p>}</FileDropZone>}
      </FileUpload>,
    );
    expect(screen.getByText('files: 0, over: false')).toBeTruthy();
  });

  it('is controlled with files + onValueChange', async () => {
    const seen: UploadFile[][] = [];
    const { container } = render(<FileUpload value={[]} onValueChange={(files) => seen.push(files)} />);
    choose(container, file('a.txt'));
    await wait();
    expect(seen[0].map((f) => f.file.name)).toEqual(['a.txt']);
    // The parent did not take the change, so the list stays empty.
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('a change a controlled owner refuses is gone: not resent, not in files() or the agent snapshot, not a duplicate', async () => {
    const seen: string[][] = [];
    const controller = createFileUploadController();
    function Host() {
      const [value, setValue] = useState<UploadFile[]>([]);
      return (
        <FileUpload
          controller={controller}
          value={value}
          onValueChange={(next) => {
            seen.push(next.map((f) => f.path));
            if (next.every((f) => !f.path.endsWith('.txt'))) setValue(next);
          }}
        />
      );
    }
    const { container } = render(<Host />);
    choose(container, file('a.txt'));
    await wait();
    expect(controller.files()).toEqual([]);
    expect(agent.snapshot().find((e) => e.component === 'file-upload' && !e.offPage)?.items ?? []).toEqual([]);
    choose(container, file('b.png', 10, 'image/png'));
    await wait();
    expect(seen).toEqual([['a.txt'], ['b.png']]);
    expect(rows().map((r) => r.querySelector('[title]')?.textContent)).toEqual(['b.png']);
    // The refused file is not held, so choosing it again is not a duplicate: it is asked for again.
    choose(container, file('a.txt'));
    await wait();
    expect(seen[2]).toEqual(['b.png', 'a.txt']);
    expect(screen.queryByRole('group', { name: 'a.txt' })).toBeNull();
  });

  it('a controlled upload whose steps arrive before the owner renders keeps every row at its latest status', async () => {
    const { upload, calls } = manual();
    const seen: UploadFile[][] = [];
    // An owner that takes every change, but renders it a little later.
    function Host() {
      const [value, setValue] = useState<UploadFile[]>([]);
      return <FileUpload upload={upload} concurrency={2} value={value} onValueChange={(next) => { seen.push(next); setTimeout(() => setValue(next), 20); }} />;
    }
    const { container } = render(<Host />);
    choose(container, file('a.txt'), file('b.txt'));
    await wait(30);
    await wait(30);
    expect(calls).toHaveLength(2);
    // a finishes, then b, each in its own task, both before the owner has rendered a's.
    await act(async () => { calls[0].resolve(); });
    await wait(5);
    await act(async () => { calls[1].resolve(); });
    await wait(50);
    expect(seen.at(-1)?.map((f) => f.status)).toEqual(['done', 'done']);
    expect(rows().map((r) => r.getAttribute('data-status'))).toEqual(['done', 'done']);
    expect(calls).toHaveLength(2);
  });

  it('a controller adds, retries, clears and starts uploads from outside, with the same reasons', async () => {
    const { upload, calls } = manual();
    const controller = createFileUploadController();
    const onValueChange = vi.fn();
    render(<FileUpload upload={upload} autoUpload={false} controller={controller} onValueChange={onValueChange} />);
    await wait();
    act(() => { controller.add([file('a.txt'), file('b.txt')]); });
    await wait();
    expect(controller.files().map((f) => f.status)).toEqual(['queued', 'queued']);
    act(() => controller.uploadAll());
    await wait();
    expect(calls).toHaveLength(2);
    await act(async () => calls[0].reject(new Error('Offline')));
    expect(controller.files()[0]).toMatchObject({ status: 'error', error: 'Offline' });
    // By path, as an agent reads it off the page.
    act(() => { expect(controller.retry('a.txt')).toBe(true); });
    await wait();
    expect(calls).toHaveLength(3);
    expect(onValueChange.mock.calls.some(([, d]: [unknown, FileUploadValueChangeDetails]) => d.reason === 'retry' && d.source === 'programmatic')).toBe(true);
    act(() => { expect(controller.clear()).toBe(true); });
    // What was still sending is aborted (the first one had failed already).
    expect(calls.slice(1).every((c) => c.ctx.signal.aborted)).toBe(true);
    expect(rows()).toHaveLength(0);
    // Nothing left to clear: refused, not reported.
    const before = onValueChange.mock.calls.length;
    expect(controller.clear()).toBe(false);
    expect(onValueChange.mock.calls.length).toBe(before);
  });

  it('is on the page for agents: its rows are items, and remove, retry, clear and uploadAll run as the agent', async () => {
    const { upload, calls } = manual();
    const onValueChange = vi.fn();
    const { container } = render(<FileUpload upload={upload} autoUpload={false} onValueChange={onValueChange} />);
    choose(container, file('a.txt'), file('b.txt'));
    await wait();
    const entry = () => agent.snapshot().find((e) => e.component === 'file-upload' && !e.offPage);
    expect(entry()?.actions).toEqual(expect.arrayContaining(['remove', 'retry', 'clear', 'uploadAll']));
    expect(entry()?.items?.map((item) => item.label)).toEqual(['a.txt', 'b.txt']);
    const step = (action: string, args: unknown[] = []) => act(() => agent.act({ steps: [{ ref: entry()?.ref ?? 'file-upload', action, args }] }));

    // autoUpload is off: the agent starts the queue.
    expect((await step('uploadAll')).ok).toBe(true);
    await wait();
    expect(calls.map((c) => c.file.name)).toEqual(['a.txt', 'b.txt']);
    await act(async () => calls[0].reject(new Error('Offline')));
    expect(rows()[0].getAttribute('data-status')).toBe('error');

    expect((await step('retry', ['a.txt'])).ok).toBe(true);
    expect(onValueChange.mock.calls.find(([, d]: [unknown, FileUploadValueChangeDetails]) => d.reason === 'retry')?.[1]).toMatchObject({ source: 'agent' });
    await wait();
    expect(calls).toHaveLength(3);

    expect((await step('remove', ['b.txt'])).ok).toBe(true);
    expect(calls[1].ctx.signal.aborted).toBe(true);
    expect(onValueChange.mock.lastCall?.[1]).toMatchObject({ reason: 'imperative', source: 'agent' });
    expect(rows().map((r) => r.textContent?.includes('a.txt'))).toEqual([true]);

    expect((await step('clear')).ok).toBe(true);
    expect(onValueChange.mock.lastCall?.[1]).toMatchObject({ reason: 'clear', source: 'agent' });
    expect(rows()).toHaveLength(0);
  });

  it('an agent step the app refuses with details.cancel() changes nothing', async () => {
    const { upload } = manual();
    const { container } = render(
      <FileUpload upload={upload} autoUpload={false} onValueChange={(_files, details) => { if (details.source === 'agent') details.cancel(); }} />,
    );
    choose(container, file('keep.txt'));
    await wait();
    const ref = agent.snapshot().find((e) => e.component === 'file-upload' && !e.offPage)?.ref ?? 'file-upload';
    await act(() => agent.act({ steps: [{ ref, action: 'clear', args: [] }] }));
    expect(rows()).toHaveLength(1);
  });

  it('takes a useFileUpload from outside, so the page can drive it', async () => {
    const { upload, calls } = manual();
    let api!: ReturnType<typeof useFileUpload>;
    function Page() {
      api = useFileUpload({ upload, autoUpload: false });
      return <FileUpload state={api} />;
    }
    render(<Page />);
    let outcome!: ReturnType<typeof api.add>;
    act(() => { outcome = api.add([file('a.txt')]); });
    expect(outcome.added.map((f) => f.file.name)).toEqual(['a.txt']);
    await wait();
    expect(calls).toHaveLength(0);
    act(() => api.uploadAll());
    await wait();
    expect(calls).toHaveLength(1);
    expect(rows()[0].getAttribute('data-status')).toBe('uploading');
  });

  it('merges className last', () => {
    const { container } = render(<FileUpload className="custom-root"><FileDropZone className="custom-zone p-0" /></FileUpload>);
    expect(container.querySelector('[data-slot=file-upload]')?.classList.contains('custom-root')).toBe(true);
    const zone = container.querySelector('[data-slot=file-input-dropzone]') as HTMLElement;
    expect(zone.classList.contains('custom-zone')).toBe(true);
    expect(zone.classList.contains('p-6')).toBe(false); // tailwind-merge: the caller's p-0 wins
  });
});

describe('parts used alone', () => {
  it('shows the zone invalid with its message and an icon, not just a color', () => {
    render(<FileDropZone invalid error="Add at least one file." onFiles={() => undefined} />);
    const msg = screen.getByText('Add at least one file.');
    expect(msg.querySelector('svg')).toBeTruthy();
    expect(document.querySelector('[data-slot=file-input-dropzone]')?.hasAttribute('data-invalid')).toBe(true);
    expect(screen.getByRole('button', { name: 'Browse files' }).getAttribute('aria-describedby')).toContain(msg.id);
  });

  it('FileUploadButton opens the chooser and hands the accepted files to onFiles', () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    const { container } = render(<FileUploadButton onFiles={onFiles} onReject={onReject} accept={['.pdf']}>Attach</FileUploadButton>);
    expect(screen.getByRole('button', { name: 'Attach' })).toBeTruthy();
    expect((container.querySelector('input[type=file]') as HTMLInputElement).accept).toBe('.pdf');
    choose(container, file('a.pdf'), file('b.txt'));
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf']);
    expect(onFiles.mock.calls[0][1]).toMatchObject({ reason: 'picker' });
    expect(onReject.mock.calls[0][0]).toMatchObject([{ reasons: ['file-type'] }]);
    // It holds nothing itself, so the same file can be chosen again.
    choose(container, file('a.pdf'));
    expect(onFiles).toHaveBeenCalledTimes(2);
  });

  it('FileDropZone takes onFiles and passes directory and capture to the input', () => {
    const { container } = render(<FileDropZone directory capture="environment" onFiles={() => undefined} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Retry x.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove x.png' }));
    expect(onRetry).toHaveBeenCalledWith(item);
    expect(onRemove).toHaveBeenCalledWith(item);
  });

  it('FileItem with no handlers and no FileUpload shows no actions', () => {
    const item: UploadFile = { id: '1', file: file('x.txt'), path: 'x.txt', status: 'done', progress: 1 };
    render(<FileItem item={item} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
