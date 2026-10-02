'use client';
import { createContext, use, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DropZone, FileTrigger, Text, composeRenderProps,
  type DropItem, type DropZoneProps, type DropZoneRenderProps,
} from 'react-aria-components';
import { useClipboard } from 'react-aria/useClipboard';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Icon, type IconName } from '@/lib/icon';
import { formatBytes } from '@/lib/format-bytes';
import { cn } from '@/lib/utils';
import {
  describeRules, entriesFromFileList, fileKind, readDropItems, useFileUpload, useFilePreview,
  type FileEntry, type FileKind, type FileRules, type FileUploadState, type UploadFile, type UseFileUploadOptions,
} from '@/lib/file-upload';

/* ══ FileUpload — pick, drop or paste files, see them, send them ══
   Built on react-aria's FileTrigger (the hidden <input type=file>) and DropZone (drag and drop, with a labelled
   button that keyboard and screen-reader users reach), driven by `useFileUpload` (lib/file-upload).

     <FileUpload accept={['image/*']} maxSize={5 * MB} upload={xhrUpload('/api/upload')} pasteable>
       <FileDropZone />          // the target: drag, browse, paste
       <FileList />              // a row per file: thumbnail, progress, retry, remove
     </FileUpload>

   The parts also work alone: `FileUploadButton` is a Button that opens the chooser, `FileDropZone` takes `onFiles`,
   and `FileItem` takes an `UploadFile` from your own `useFileUpload`. Inside a `FileUpload` they share its state
   and rules, a polite live region announces files added, rejected, removed, failed and done (never progress
   ticks), and removing a row moves focus to its neighbor. */

export interface FilesInfo {
  /** How the files arrived. */
  source: 'drop' | 'browse' | 'paste';
  /** A dropped folder held more files than were read. */
  truncated: boolean;
  /** Dropped folders that were skipped because the target doesn't take folders. */
  skippedFolders: number;
}
type OnFiles = (entries: FileEntry[], info: FilesInfo) => void;

/* ── Context ── */

export interface FileUploadContextValue extends FileUploadState {
  disabled: boolean;
  multiple: boolean;
  acceptDirectory: boolean;
  defaultCamera?: 'user' | 'environment';
  pasteable: boolean;
  /** A message about the last drop that isn't a per-file rejection (folders skipped, a folder cut short). */
  notice: string | null;
  /** Adds files from the zone or button (validates, announces). */
  addFiles: OnFiles;
  /** Removes a row and moves focus to its neighbor (the rows' Remove button uses it). */
  dismiss: (id: string) => void;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

/** The nearest FileUpload's state and settings, or null outside one. */
export function useFileUploadContext(): FileUploadContextValue | null {
  return use(FileUploadContext);
}

/* ── Live announcements ── */

interface Pending { added: number; rejected: UploadFile[]; removed: string[]; failed: string[]; done: string[]; notes: string[] }
const fresh = (): Pending => ({ added: 0, rejected: [], removed: [], failed: [], done: [], notes: [] });
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What changed in the list, as one polite sentence after a short pause: so a batch is one announcement and progress ticks never speak. */
function useAnnouncements(files: readonly UploadFile[]) {
  const [message, setMessage] = useState('');
  const known = useRef<Map<string, { name: string; status: UploadFile['status'] }> | null>(null);
  const pending = useRef<Pending>(fresh());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flip = useRef(false);

  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = pending.current;
      pending.current = fresh();
      const parts: string[] = [];
      if (p.added) parts.push(plural(p.added, '1 file added', `${p.added} files added`));
      if (p.rejected.length) {
        parts.push(p.rejected.length === 1 ? `${p.rejected[0].file.name} rejected. ${p.rejected[0].error ?? ''}`.trim() : `${p.rejected.length} files rejected`);
      }
      if (p.done.length) parts.push(p.done.length === 1 ? `${p.done[0]} uploaded` : `${p.done.length} files uploaded`);
      if (p.failed.length) parts.push(p.failed.length === 1 ? `${p.failed[0]} failed to upload` : `${p.failed.length} uploads failed`);
      if (p.removed.length) parts.push(p.removed.length === 1 ? `${p.removed[0]} removed` : `${p.removed.length} files removed`);
      parts.push(...p.notes);
      if (!parts.length) return;
      // The same sentence twice in a row would not be announced again; a trailing no-break space makes it a new string.
      flip.current = !flip.current;
      setMessage(parts.join('. ').replace(/\.$/, '') + '.' + (flip.current ? '' : ' '));
    }, 300);
  };

  useEffect(() => {
    const now = new Map(files.map((f) => [f.id, { name: f.file.name, status: f.status }]));
    const before = known.current;
    known.current = now;
    if (!before) return;
    const p = pending.current;
    let changed = false;
    for (const f of files) {
      const was = before.get(f.id);
      if (!was) {
        if (f.status === 'rejected') p.rejected.push(f);
        else p.added++;
        changed = true;
      } else if (was.status !== f.status) {
        if (f.status === 'done') p.done.push(f.file.name);
        else if (f.status === 'error') p.failed.push(f.file.name);
        else continue;
        changed = true;
      }
    }
    for (const [id, was] of before) {
      if (!now.has(id)) {
        p.removed.push(was.name);
        changed = true;
      }
    }
    if (changed) schedule();
  }, [files]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const note = (text: string) => {
    pending.current.notes.push(text);
    schedule();
  };
  return { message, note };
}

/* ── FileUpload ── */

export interface FileUploadProps extends UseFileUploadOptions {
  /** Bring your own `useFileUpload` (to call `uploadAll()` or read the list outside); the rule props here are then ignored. */
  state?: FileUploadState;
  /** Whether several files can be chosen at once. Default: unless `maxFiles` is 1. */
  multiple?: boolean;
  /** Choose and read whole folders. Dropped and picked files keep their relative paths. */
  acceptDirectory?: boolean;
  /** Open the camera directly on phones (`user` front, `environment` rear). */
  defaultCamera?: 'user' | 'environment';
  /** Take files pasted while the zone's buttons are focused. */
  pasteable?: boolean;
  disabled?: boolean;
  /** Default: a `FileDropZone` and a `FileList`. A function receives the context. */
  children?: ReactNode | ((api: FileUploadContextValue) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

export function FileUpload({ state, children, className, style, multiple, acceptDirectory = false, defaultCamera, pasteable = false, disabled = false, ...options }: FileUploadProps) {
  // The hook always runs; a `state` from outside simply replaces its result.
  const own = useFileUpload(state ? {} : options);
  return (
    <FileUploadRoot
      api={state ?? own}
      multiple={multiple ?? (state ? state.rules.maxFiles !== 1 : options.maxFiles !== 1)}
      acceptDirectory={acceptDirectory}
      defaultCamera={defaultCamera}
      pasteable={pasteable}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </FileUploadRoot>
  );
}

interface RootProps extends Pick<FileUploadProps, 'children' | 'className' | 'style' | 'defaultCamera'> {
  api: FileUploadState;
  multiple: boolean;
  acceptDirectory: boolean;
  pasteable: boolean;
  disabled: boolean;
}

function FileUploadRoot({ api, children, className, style, multiple, acceptDirectory, defaultCamera, pasteable, disabled }: RootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { message, note } = useAnnouncements(api.files);
  const [notice, setNotice] = useState<string | null>(null);
  // Which row to focus once a removed row is gone: a neighbor's Remove button, else the zone's button.
  const focusAfter = useRef<string | 'trigger' | null>(null);

  const dismiss = (id: string) => {
    const rows = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-slot=file-item]') ?? []);
    const i = rows.findIndex((row) => row.dataset.fileId === id);
    const neighbor = rows[i + 1] ?? rows[i - 1];
    focusAfter.current = neighbor?.dataset.fileId ?? 'trigger';
    api.remove(id);
  };

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const root = rootRef.current;
    const el =
      target === 'trigger'
        ? root?.querySelector<HTMLElement>('[data-file-trigger]')
        : (Array.from(root?.querySelectorAll<HTMLElement>('[data-slot=file-item]') ?? [])
            .find((row) => row.dataset.fileId === target)
            ?.querySelector<HTMLElement>('[data-slot=file-item-remove]') ?? root?.querySelector<HTMLElement>('[data-file-trigger]'));
    el?.focus();
  }, [api.files]);

  const addFiles: OnFiles = (entries, info) => {
    if (disabled) return;
    const notes: string[] = [];
    if (info.skippedFolders) notes.push('Folders can’t be added here. Choose files instead.');
    if (info.truncated) notes.push('The folder was too large to read in full. Only the first files were added.');
    setNotice(notes.join(' ') || null);
    for (const text of notes) note(text);
    if (entries.length) api.add(entries);
  };

  const value: FileUploadContextValue = { ...api, disabled, multiple, acceptDirectory, defaultCamera, pasteable, notice, addFiles, dismiss };
  return (
    <FileUploadContext value={value}>
      <div ref={rootRef} data-slot="file-upload" className={cn('flex w-full flex-col gap-3', className)} style={style}>
        {typeof children === 'function' ? children(value) : (children ?? <><FileDropZone /><FileList /></>)}
        <div data-slot="file-upload-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {message}
        </div>
      </div>
    </FileUploadContext>
  );
}

/* ── Reading what arrives ── */

/** Turns a drop or paste into entries (folders flattened) and hands them over. */
async function takeItems(items: Iterable<DropItem>, source: FilesInfo['source'], directories: boolean, deliver: OnFiles, native: File[] = []) {
  const read = await readDropItems(items, { directories });
  // `webkitGetAsEntry` can come back empty for files that don't live on disk (a script's DataTransfer, some
  // sources on some browsers); the drop's own file list still has them.
  const entries = read.entries.length || read.skippedFolders ? read.entries : native.map((file) => ({ file, path: file.name }));
  if (!entries.length && !read.skippedFolders) return;
  deliver(entries, { source, truncated: read.truncated, skippedFolders: read.skippedFolders });
}

/* ── FileDropZone ── */

export const fileDropZoneVariants = cva(
  'group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none data-drop-target:border-primary data-drop-target:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-invalid:border-destructive data-disabled:opacity-40',
  {
    variants: {
      size: {
        default: 'min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6',
        compact: 'flex-row items-center justify-start gap-3 rounded-panel p-3 text-left',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

type ZoneRules = Pick<FileRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>;

export interface FileDropZoneProps
  extends Omit<DropZoneProps, 'children' | 'className' | 'onDrop' | 'isDisabled'>,
    VariantProps<typeof fileDropZoneVariants> {
  /** Called with the chosen, dropped or pasted files. Inside a `FileUpload` the default adds them to its list. */
  onFiles?: OnFiles;
  /** What the zone takes: sets the chooser's filter and the hint under the title. Defaults to the `FileUpload`'s rules. */
  rules?: ZoneRules;
  /** The line under the title; default is built from the rules ("Images and PDFs · up to 5 MB each"). */
  hint?: ReactNode;
  /** Title while idle (default "Drag files here"). */
  title?: ReactNode;
  /** An Icon name or any node (default an upward arrow). */
  icon?: IconName | ReactNode;
  /** The button's text (default "Browse files"). */
  browseLabel?: string;
  multiple?: boolean;
  acceptDirectory?: boolean;
  defaultCamera?: 'user' | 'environment';
  /** Take files pasted while the zone or its button has focus (⌘V / Ctrl+V). Default false. */
  pasteable?: boolean;
  /** Red outline and the `error` message (with an icon, so color isn't the only signal). */
  isInvalid?: boolean;
  error?: ReactNode;
  isDisabled?: boolean;
  /** Replace the contents; a function receives react-aria's render state (`isDropTarget`, `isFocusVisible`…). */
  children?: ReactNode | ((state: DropZoneRenderProps) => ReactNode);
  className?: string | ((state: DropZoneRenderProps) => string);
}

export function FileDropZone({
  className, size, onFiles, rules, hint, title = 'Drag files here', icon = 'arrow-up', browseLabel = 'Browse files',
  multiple, acceptDirectory, defaultCamera, pasteable, isInvalid, error, isDisabled, children, ...props
}: FileDropZoneProps) {
  const ctx = useFileUploadContext();
  const disabled = isDisabled ?? ctx?.disabled ?? false;
  const allowsMultiple = multiple ?? ctx?.multiple ?? true;
  const directories = acceptDirectory ?? ctx?.acceptDirectory ?? false;
  const canPaste = pasteable ?? ctx?.pasteable ?? false;
  const effective = rules ?? ctx?.rules ?? {};
  const deliver: OnFiles = (entries, info) => (onFiles ?? ctx?.addFiles)?.(entries, info);
  const hintText = hint ?? describeRules(effective);
  const hintId = useId();
  const errorId = useId();
  const noticeId = useId();
  const notice = ctx?.notice;
  // A drag, real or keyboard-driven, announces itself with onDropEnter; a paste reaches onDrop without one.
  const dragging = useRef(false);
  // The raw file list of a drop or paste, read before react-aria turns it into items (it cannot read pasted files).
  const zoneRef = useRef<HTMLDivElement>(null);
  const nativeFiles = useRef<File[]>([]);
  useEffect(() => {
    const el = zoneRef.current;
    const onDrop = (e: DragEvent) => {
      nativeFiles.current = Array.from(e.dataTransfer?.files ?? []);
    };
    const onPaste = (e: ClipboardEvent) => {
      nativeFiles.current = el?.contains(document.activeElement) ? Array.from(e.clipboardData?.files ?? []) : [];
    };
    el?.addEventListener('drop', onDrop, true);
    document.addEventListener('paste', onPaste, true);
    return () => {
      el?.removeEventListener('drop', onDrop, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, []);
  const takeNative = () => {
    const files = nativeFiles.current;
    nativeFiles.current = [];
    return files;
  };

  const { clipboardProps } = useClipboard({
    isDisabled: !canPaste || disabled,
    onPaste: (items) => void takeItems(items, 'paste', directories, deliver, takeNative()),
  });

  const labelledBy = [hintText ? hintId : null, isInvalid && error ? errorId : null, notice ? noticeId : null].filter(Boolean).join(' ') || undefined;
  return (
    <DropZone
      ref={zoneRef}
      data-slot="file-drop-zone"
      data-invalid={isInvalid || undefined}
      aria-labelledby={labelledBy}
      {...props}
      isDisabled={disabled}
      className={composeRenderProps(className, (cls) => cn(fileDropZoneVariants({ size }), cls))}
      onDropEnter={(e) => {
        dragging.current = true;
        props.onDropEnter?.(e);
      }}
      onDropExit={(e) => {
        dragging.current = false;
        props.onDropExit?.(e);
      }}
      onDrop={(e) => {
        const source = dragging.current ? 'drop' : 'paste';
        if (source === 'paste' && !canPaste) return;
        void takeItems(e.items, source, directories, deliver, takeNative());
      }}
    >
      {(state) =>
        typeof children === 'function' ? (
          children(state)
        ) : (
          children ?? (
            <>
              <span
                data-slot="file-drop-zone-icon"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors duration-spring-snappy group-data-drop-target/zone:bg-primary group-data-drop-target/zone:text-primary-foreground motion-reduce:transition-none"
              >
                {typeof icon === 'string' ? <Icon name={icon as IconName} size={20} sw={2} /> : icon}
              </span>
              <div className={cn('flex min-w-0 flex-col gap-0.5', size === 'compact' ? 'flex-1 items-start' : 'items-center')}>
                <Text slot="label" className="text-subhead font-semibold text-foreground">
                  {state.isDropTarget ? 'Drop to add' : title}
                </Text>
                {hintText ? (
                  <span id={hintId} className="text-footnote text-foreground/70">
                    {hintText}
                  </span>
                ) : null}
                {isInvalid && error ? (
                  <span id={errorId} className="flex items-center gap-1 text-footnote font-medium text-foreground">
                    <Icon name="exclamation-circle-fill" size={14} className="text-destructive" />
                    {error}
                  </span>
                ) : null}
                {notice ? (
                  <span id={noticeId} className="flex items-center gap-1 text-footnote text-foreground">
                    <Icon name="info-fill" size={14} className="text-muted-foreground" />
                    {notice}
                  </span>
                ) : null}
              </div>
              <FileTrigger
                acceptedFileTypes={effective.accept}
                allowsMultiple={allowsMultiple}
                acceptDirectory={directories}
                defaultCamera={defaultCamera ?? ctx?.defaultCamera}
                onSelect={(list) => {
                  const entries = entriesFromFileList(list);
                  if (entries.length) deliver(entries, { source: 'browse', truncated: false, skippedFolders: 0 });
                }}
              >
                <Button variant="secondary" size="sm" isDisabled={disabled} data-file-trigger="" onFocus={(e) => clipboardProps.onFocus?.(e as never)} onBlur={(e) => clipboardProps.onBlur?.(e as never)}>
                  {browseLabel}
                </Button>
              </FileTrigger>
            </>
          )
        )
      }
    </DropZone>
  );
}

/* ── FileUploadButton ── */

export interface FileUploadButtonProps extends ButtonProps {
  onFiles?: OnFiles;
  accept?: readonly string[];
  multiple?: boolean;
  acceptDirectory?: boolean;
  defaultCamera?: 'user' | 'environment';
}

/** A Button that opens the file chooser — a react-aria FileTrigger around our Button. */
export function FileUploadButton({
  onFiles, accept, multiple, acceptDirectory, defaultCamera, children = 'Upload files', isDisabled, ...props
}: FileUploadButtonProps) {
  const ctx = useFileUploadContext();
  return (
    <FileTrigger
      acceptedFileTypes={accept ?? ctx?.rules.accept}
      allowsMultiple={multiple ?? ctx?.multiple ?? true}
      acceptDirectory={acceptDirectory ?? ctx?.acceptDirectory ?? false}
      defaultCamera={defaultCamera ?? ctx?.defaultCamera}
      onSelect={(list) => {
        const entries = entriesFromFileList(list);
        if (entries.length) (onFiles ?? ctx?.addFiles)?.(entries, { source: 'browse', truncated: false, skippedFolders: 0 });
      }}
    >
      <Button data-slot="file-upload-button" data-file-trigger="" isDisabled={isDisabled ?? ctx?.disabled} {...props}>
        {children}
      </Button>
    </FileTrigger>
  );
}

/* ── FileList / FileItem ── */

const KIND_ICON: Record<FileKind, IconName> = {
  image: 'photo', video: 'video', audio: 'music-note', pdf: 'doc', text: 'doc', archive: 'archivebox', other: 'doc',
};

/** The row's leading tile: an image's own thumbnail (object URL, revoked when the row goes), else an icon for its kind. */
export function FileThumbnail({ file, disabled, className }: { file: File; disabled?: boolean; className?: string }) {
  const kind = fileKind(file);
  const url = useFilePreview(file, kind === 'image' && !disabled);
  return (
    <span
      data-slot="file-thumbnail"
      className={cn('grid size-10 shrink-0 place-items-center overflow-hidden rounded-ctl bg-secondary text-muted-foreground', className)}
    >
      {url ? <img src={url} alt="" decoding="async" className="size-full object-cover" /> : <Icon name={KIND_ICON[kind]} size={20} />}
    </span>
  );
}

export const fileItemVariants = cva(
  'box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground transition-colors duration-spring-snappy motion-reduce:transition-none data-[status=error]:border-destructive data-[status=rejected]:border-destructive',
);

export interface FileItemProps {
  item: UploadFile;
  /** Default: the context's `dismiss` (removes the row, moves focus). */
  onRemove?: (item: UploadFile) => void;
  /** Default: the context's `retry`. */
  onRetry?: (item: UploadFile) => void;
  /** Replaces the row's contents (the labelled group and its status stay). */
  children?: ReactNode | ((item: UploadFile) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

/** One file: thumbnail, name, size, status, a progress bar while sending, Retry on failure and Remove. A labelled group. */
export function FileItem({ item, onRemove, onRetry, children, className, style }: FileItemProps) {
  const ctx = useFileUploadContext();
  const nameId = useId();
  const { status, file, path } = item;
  const name = file.name;
  const pct = Math.round(item.progress * 100);
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const remove = () => (onRemove ? onRemove(item) : ctx ? ctx.dismiss(item.id) : undefined);
  const retry = () => (onRetry ? onRetry(item) : ctx?.retry(item.id));
  const showRetry = status === 'error' && (onRetry || ctx);
  const showRemove = onRemove || ctx;

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-slot="file-item"
      data-file-id={item.id}
      data-status={status}
      className={cn(fileItemVariants(), className)}
      style={style}
    >
      {typeof children === 'function' ? children(item) : (children ?? (
        <>
          <FileThumbnail file={file} disabled={status === 'rejected'} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span id={nameId} title={path} className="truncate text-subhead font-medium text-foreground">
              {name}
            </span>
            <span data-slot="file-item-status" className="flex min-w-0 items-start gap-1.5 text-footnote text-foreground/70">
              {status === 'done' ? <Icon name="check-circle-fill" size={14} className="mt-px shrink-0 text-success" /> : null}
              {status === 'error' || status === 'rejected' ? <Icon name="exclamation-circle-fill" size={14} className="mt-px shrink-0 text-destructive" /> : null}
              {/* A reason is the point of an error row: it wraps instead of truncating. */}
              <span className={cn('min-w-0', status === 'rejected' || status === 'error' ? 'break-words' : 'truncate')}>
                {status === 'rejected' || status === 'error' ? (
                  <>
                    <span className="font-medium">{status === 'rejected' ? 'Not added' : 'Upload failed'}</span>
                    {item.error ? ` · ${item.error}` : ''}
                  </>
                ) : (
                  <>
                    {formatBytes(file.size)}
                    {folder ? ` · ${folder}` : ''}
                    {status === 'queued' ? ' · Waiting' : ''}
                    {status === 'uploading' ? <span className="tabular-nums"> · Uploading {pct}%</span> : ''}
                    {status === 'done' ? ' · Uploaded' : ''}
                  </>
                )}
              </span>
            </span>
            {status === 'uploading' ? <Progress aria-label={`Uploading ${name}`} value={pct} size="sm" /> : null}
          </div>
          {showRetry ? (
            <Button data-slot="file-item-retry" variant="secondary" size="sm" aria-label={`Retry ${name}`} onPress={retry}>
              Retry
            </Button>
          ) : null}
          {showRemove ? (
            <Button
              data-slot="file-item-remove"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={status === 'uploading' ? `Cancel upload of ${name}` : status === 'rejected' ? `Dismiss ${name}` : `Remove ${name}`}
              onPress={remove}
            >
              <Icon name="xmark" size={16} sw={2.2} />
            </Button>
          ) : null}
        </>
      ))}
    </div>
  );
}

export interface FileListProps {
  /** Default: the context's files. */
  files?: readonly UploadFile[];
  /** Render a row yourself; default `<FileItem item={…} />`. */
  children?: (item: UploadFile) => ReactNode;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** The files as a list of `FileItem`s. Renders nothing while it is empty. */
export function FileList({ files, children, className, style, 'aria-label': ariaLabel = 'Files' }: FileListProps) {
  const ctx = useFileUploadContext();
  const list = files ?? ctx?.files ?? [];
  if (!list.length) return null;
  return (
    <ul data-slot="file-list" aria-label={ariaLabel} className={cn('m-0 flex list-none flex-col gap-2 p-0', className)} style={style}>
      {list.map((item) => (
        <li key={item.id} className="min-w-0">
          {children ? children(item) : <FileItem item={item} />}
        </li>
      ))}
    </ul>
  );
}
