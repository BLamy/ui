'use client';
import { createContext, use, useId, useMemo, type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import {
  FileInput, FileInputDropzone, FileInputItem, FileInputItemRemove, FileInputList, FileInputTrigger,
  type FileInputDropzoneState, type FileInputState, type FileInputValueChangeDetails, type FileRejection,
} from '@ui-sdk/react/file-input';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Icon, type IconName } from '@/lib/icon';
import { formatFileSize } from '@/lib/file-size';
import { cn, cx, type ClassProp } from '@/lib/utils';
import { describeRules, fileKind, type FileKind, type FileUploadRules, type UploadFile } from '@/lib/file-upload-model';
import type { FileUploadOptions } from '@/lib/file-upload-primitive';
import { useFileUpload, useFilePreview, type FileUploadState } from '@/lib/use-file-upload';

/* ══ FileUpload — pick, drop or paste files, see them, send them ══
   Built on UI SDK's FileInput: the trigger opens the system picker, the drop zone takes drops (folders included)
   and pastes while focus is inside it, the checks run on every file, and the list has one Tab stop (arrow keys
   move, Delete removes). The `fileUpload` primitive (lib/file-upload-primitive, through `useFileUpload`) keeps the
   rows and sends them; its root is the FileInput's element, so agents can remove, retry, clear and start uploads.

     <FileUpload accept={['image/*']} maxSize={5 * MB} upload={xhrUpload('/api/upload')}>
       <FileUploadDropzone />          // the target: drag, browse, paste
       <FileUploadList />              // a row per file: thumbnail, progress, retry, remove
     </FileUpload>

   The parts take UI SDK's FileInput names (Dropzone, Trigger, List, Item) after the kit's root. They also work alone:
   `FileUploadTrigger` is a Button that opens the chooser and `FileUploadDropzone` a zone, each handing the files it
   takes to `onFiles`; `FileUploadItem` takes an `UploadFile` from your own `useFileUpload`. Inside a `FileUpload`
   they share its state and rules, and FileInput announces what was added, rejected and removed; the hook announces
   uploads that finish or fail (never progress ticks).

   In a form it is a Field control, like UI SDK's FileInput: the Field's label names the trigger, `required` blocks an
   empty submit, and the zone draws the Field's invalid state (a red border) while a FieldError says why.
     <Field name="docs"><FieldLabel>Documents</FieldLabel><FileUpload required /><FieldError /></Field> */

/** What a part outside a `FileUpload` hands over: the files it took and FileInput's change details. */
export type FileUploadFilesHandler = (files: File[], details: FileInputValueChangeDetails) => void;

/* ── Context ── */

export interface FileUploadContextValue extends FileUploadState {
  disabled: boolean;
  multiple: boolean;
  directory: boolean;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

/** The nearest FileUpload's state and settings, or null outside one. */
export function useFileUploadContext(): FileUploadContextValue | null {
  return use(FileUploadContext);
}

/* ── FileUpload ── */

export interface FileUploadProps
  extends FileUploadOptions,
    Omit<ComponentProps<typeof FileInput>, keyof FileUploadOptions | 'onReject' | 'children' | 'className' | 'style' | 'name' | 'form' | 'required' | 'disabled' | 'multiple' | 'directory' | 'capture'> {
  /** Bring your own `useFileUpload` (to read the list outside); the list props here are then ignored. To only call
   *  `uploadAll()` or `clear()` from outside, pass a `controller` instead. */
  state?: FileUploadState;
  /** Whether several files can be chosen at once. Default: unless `maxFiles` is 1. */
  multiple?: boolean;
  /** Choose whole folders. Picked and dropped files keep their paths inside the folder. */
  directory?: boolean;
  /** Open the camera directly on phones (`user` front, `environment` rear). */
  capture?: boolean | 'user' | 'environment';
  disabled?: boolean;
  /** Submit the files with a form under this name. */
  name?: string;
  form?: string;
  required?: boolean;
  /** Default: a `FileUploadDropzone` and a `FileUploadList`. A function receives the context. */
  children?: ReactNode | ((api: FileUploadContextValue) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

/** The root: UI SDK's FileInput holding the rows. Its other props (`id`, `ref`, `aria-*`, `data-*`, `announcement`)
    reach the FileInput's element. */
export function FileUpload({
  state, children, className, style, multiple, directory = false, capture, disabled = false, name, form, required,
  upload, autoUpload, concurrency, value: list, defaultValue, onValueChange, onAdd, onRemove, onUploaded, onUploadError, controller,
  accept, maxSize, minSize, maxFiles, allowDuplicates, validate, messages,
  ...props
}: FileUploadProps) {
  const options: FileUploadOptions = {
    upload, autoUpload, concurrency, value: list, defaultValue, onValueChange, onAdd, onRemove, onUploaded, onUploadError, controller,
    accept, maxSize, minSize, maxFiles, allowDuplicates, validate, messages,
  };
  // The hook always runs; a `state` from outside simply replaces its result.
  const own = useFileUpload(state ? {} : options);
  const api = state ?? own;
  const allowsMultiple = multiple ?? (directory || api.inputProps.multiple);
  const value = useMemo<FileUploadContextValue>(
    () => ({ ...api, disabled, multiple: allowsMultiple, directory }),
    [api, disabled, allowsMultiple, directory],
  );
  return (
    <FileUploadContext value={value}>
      {/* `inputProps.render` makes the FileInput's element the list's root too (named for agents, with its rows). */}
      <FileInput
        {...props}
        {...api.inputProps}
        multiple={allowsMultiple}
        directory={directory}
        capture={capture}
        disabled={disabled}
        name={name}
        form={form}
        required={required}
        className={cn('flex w-full flex-col gap-3', className)}
        style={style}
      >
        {typeof children === 'function' ? children(value) : (children ?? <><FileUploadDropzone /><FileUploadList /></>)}
      </FileInput>
    </FileUploadContext>
  );
}

/* ── A FileInput of its own, for a part used outside a FileUpload ── */

const NO_FILES: File[] = [];

interface OwnInputProps {
  onFiles?: FileUploadFilesHandler;
  onReject?: (rejected: FileRejection[]) => void;
  rules?: ZoneRules;
  multiple?: boolean;
  directory?: boolean;
  capture?: boolean | 'user' | 'environment';
  disabled?: boolean;
  children: ReactNode;
}

/** Holds nothing: every accepted batch goes straight to `onFiles`. Lays out as if it weren't there. */
function OwnInput({ onFiles, onReject, rules, multiple = true, directory, capture, disabled, children }: OwnInputProps) {
  return (
    <FileInput
      className="contents"
      value={NO_FILES}
      onValueChange={(_value, details) => {
        if (details.added.length) onFiles?.(details.added, details);
      }}
      onReject={onReject}
      accept={rules?.accept}
      maxSize={rules?.maxSize}
      minSize={rules?.minSize}
      maxFiles={rules?.maxFiles}
      multiple={multiple}
      directory={directory}
      capture={capture}
      disabled={disabled}
    >
      {children}
    </FileInput>
  );
}

/* ── FileUploadDropzone ── */

/** The zone draws its Field's invalid state (a red border): from the Field around it (`data-invalid` on the Field's
    root) or on the trigger inside it. */
export const fileUploadDropzoneVariants = cva(
  [
    'group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none',
    'data-dragging:border-primary data-dragging:bg-primary/10 in-data-invalid:border-destructive has-[[data-invalid]]:border-destructive data-disabled:opacity-40',
  ],
  {
    variants: {
      /** `vertical`: icon, title and button stacked in a tall target. `horizontal`: one row, for a form or a panel. */
      orientation: {
        vertical: 'min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6',
        horizontal: 'flex-row items-center justify-start gap-3 rounded-panel p-3 text-start',
      },
    },
    defaultVariants: { orientation: 'vertical' },
  },
);

type ZoneRules = Pick<FileUploadRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>;

export interface FileUploadDropzoneProps
  extends Omit<ComponentProps<typeof FileInputDropzone>, 'children' | 'className' | 'title'>,
    VariantProps<typeof fileUploadDropzoneVariants> {
  /** Takes the files itself, with a FileInput of its own (also inside a `FileUpload`, which then doesn't list them). */
  onFiles?: FileUploadFilesHandler;
  /** With `onFiles`: the files the rules turned away. */
  onReject?: (rejected: FileRejection[]) => void;
  /** What the zone takes: the hint under the title, and (with `onFiles`) the checks. Defaults to the `FileUpload`'s rules. */
  rules?: ZoneRules;
  /** The line under the title; default is built from the rules ("Images and PDFs · up to 5 MB each"). */
  hint?: ReactNode;
  /** Title while idle (default "Drag files here"). */
  title?: ReactNode;
  /** An Icon name or any node (default an upward arrow). */
  icon?: IconName | ReactNode;
  /** The button's text (default "Browse files"). */
  browseLabel?: string;
  /** With `onFiles`. Default true. */
  multiple?: boolean;
  /** With `onFiles`: choose whole folders. */
  directory?: boolean;
  /** With `onFiles`: open the camera on phones. */
  capture?: boolean | 'user' | 'environment';
  /** With `onFiles`; inside a `FileUpload`, its `disabled`. */
  disabled?: boolean;
  /** Replace the contents; a function receives the zone's state (`dragging`, `dragAccept`, `dragReject`, `disabled`). */
  children?: ReactNode | ((state: FileInputDropzoneState) => ReactNode);
  className?: ClassProp<FileInputDropzoneState>;
}

export function FileUploadDropzone({
  className, orientation, onFiles, onReject, rules, hint, title = 'Drag files here', icon = 'arrow-up', browseLabel = 'Browse files',
  multiple, directory, capture, disabled, children, ...props
}: FileUploadDropzoneProps) {
  const ctx = useFileUploadContext();
  const effective = rules ?? ctx?.rules ?? {};
  const hintText = hint ?? describeRules(effective);
  const hintId = useId();

  const zone = (
    <FileInputDropzone {...props} className={cx(fileUploadDropzoneVariants({ orientation }), className)}>
      {(state) =>
        typeof children === 'function' ? (
          children(state)
        ) : (
          children ?? (
            <>
              <span
                data-slot="file-upload-dropzone-icon"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors duration-spring-snappy group-data-dragging/zone:bg-primary group-data-dragging/zone:text-primary-foreground motion-reduce:transition-none"
              >
                {typeof icon === 'string' ? <Icon name={icon as IconName} size={20} sw={2} /> : icon}
              </span>
              <div className={cn('flex min-w-0 flex-col gap-0.5', orientation === 'horizontal' ? 'flex-1 items-start' : 'items-center')}>
                <span className="text-subhead font-semibold text-foreground">{state.dragging ? 'Drop to add' : title}</span>
                {hintText ? (
                  <span id={hintId} className="text-footnote text-foreground/70">
                    {hintText}
                  </span>
                ) : null}
              </div>
              <FileInputTrigger aria-describedby={hintText ? hintId : undefined} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                {browseLabel}
              </FileInputTrigger>
            </>
          )
        )
      }
    </FileInputDropzone>
  );

  if (ctx && !onFiles) return zone;
  return (
    <OwnInput onFiles={onFiles} onReject={onReject} rules={effective} multiple={multiple} directory={directory} capture={capture} disabled={disabled ?? ctx?.disabled}>
      {zone}
    </OwnInput>
  );
}

/* ── FileUploadTrigger ── */

export interface FileUploadTriggerProps
  extends Omit<ComponentProps<typeof FileInputTrigger>, 'className'>,
    VariantProps<typeof buttonVariants> {
  /** Takes the files itself, with a FileInput of its own (also inside a `FileUpload`, which then doesn't list them). */
  onFiles?: FileUploadFilesHandler;
  onReject?: (rejected: FileRejection[]) => void;
  /** With `onFiles`: the types the chooser offers and accepts. */
  accept?: string | readonly string[];
  /** With `onFiles`. Default true. */
  multiple?: boolean;
  directory?: boolean;
  capture?: boolean | 'user' | 'environment';
  disabled?: boolean;
  className?: ClassProp<FileInputState>;
}

/** A Button that opens the file chooser: UI SDK's FileInputTrigger with the Button's look. */
export function FileUploadTrigger({
  onFiles, onReject, accept, multiple, directory, capture, disabled, variant, size, className, children = 'Upload files', ...props
}: FileUploadTriggerProps) {
  const ctx = useFileUploadContext();
  const trigger = (
    <FileInputTrigger data-file-upload-trigger="" {...props} className={cx(buttonVariants({ variant, size }), className)}>
      {children}
    </FileInputTrigger>
  );
  if (ctx && !onFiles) return trigger;
  return (
    <OwnInput onFiles={onFiles} onReject={onReject} rules={{ accept: accept ?? ctx?.rules.accept }} multiple={multiple} directory={directory} capture={capture} disabled={disabled ?? ctx?.disabled}>
      {trigger}
    </OwnInput>
  );
}

/* ── FileUploadList / FileUploadItem ── */

const KIND_ICON: Record<FileKind, IconName> = {
  image: 'photo', video: 'video', audio: 'music-note', pdf: 'doc', text: 'doc', archive: 'archivebox', other: 'doc',
};

/** The row's leading tile: an image's own thumbnail (object URL, revoked when the row goes), else an icon for its kind. */
export interface FileUploadThumbnailProps {
  file: File;
  /** Draw an image file's own thumbnail (default true); `false` shows its kind's icon without reading the file. */
  preview?: boolean;
  className?: string;
}

export function FileUploadThumbnail({ file, preview = true, className }: FileUploadThumbnailProps) {
  const kind = fileKind(file);
  const url = useFilePreview(file, kind === 'image' && preview);
  return (
    <span
      data-slot="file-upload-thumbnail"
      className={cn('grid size-10 shrink-0 place-items-center overflow-hidden rounded-ctl bg-secondary text-muted-foreground', className)}
    >
      {url ? <img src={url} alt="" decoding="async" className="size-full object-cover" /> : <Icon name={KIND_ICON[kind]} size={20} />}
    </span>
  );
}

export const fileUploadItemVariants = cva(
  'box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground outline-none transition-colors duration-spring-snappy motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring data-[status=error]:border-destructive data-[status=rejected]:border-destructive',
);

// The row action: the 28px `icon-sm` tool (its hit area reaches 44px on touch), quiet until hovered.
const removeClass = buttonVariants({ variant: 'quiet', size: 'icon-sm' });
const removeLabel = ({ status, file }: UploadFile) =>
  status === 'uploading' ? `Cancel upload of ${file.name}` : status === 'rejected' ? `Dismiss ${file.name}` : `Remove ${file.name}`;

/** Thumbnail, name, size, status, a progress bar while sending, Retry on failure, then the remove button given. */
function FileUploadItemBody({ item, nameId, onRetry, remove }: { item: UploadFile; nameId?: string; onRetry?: () => void; remove?: ReactNode }) {
  const { status, file, path } = item;
  const name = file.name;
  const pct = Math.round(item.progress * 100);
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return (
    <>
      <FileUploadThumbnail file={file} preview={status !== 'rejected'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span id={nameId} title={path} className="truncate text-subhead font-medium text-foreground">
          {name}
        </span>
        <span data-slot="file-upload-item-status" className="flex min-w-0 items-start gap-1.5 text-footnote text-foreground/70">
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
                {formatFileSize(file.size)}
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
      {status === 'error' && onRetry ? (
        <Button data-file-item-retry="" variant="secondary" size="sm" aria-label={`Retry ${name}`} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      {remove}
    </>
  );
}

export interface FileUploadItemProps {
  item: UploadFile;
  /** Default: inside a `FileUpload`, removes the row (FileInput's remove, for a listed file). */
  onRemove?: (item: UploadFile) => void;
  /** Default: the context's `retry`. */
  onRetry?: (item: UploadFile) => void;
  /** Replaces the row's contents. */
  children?: ReactNode | ((item: UploadFile) => ReactNode);
  className?: string;
  style?: CSSProperties;
}

/** The item part's props, when a FileUploadList renders this row as one of the FileInput's list items. */
const ListedRowContext = createContext<Record<string, unknown> | null>(null);

/**
 * One file: thumbnail, name, size, status, a progress bar while sending, Retry on failure and Remove. Inside a
 * `FileUpload`, a listed file is a FileInputItem (arrows move between rows, Delete removes, Remove stays out of the
 * Tab order); any other row (a rejected file, or one outside a FileUpload) is a labelled group.
 */
export function FileUploadItem({ item, onRemove, onRetry, children, className, style }: FileUploadItemProps) {
  const ctx = useFileUploadContext();
  const slotProps = use(ListedRowContext);
  const nameId = useId();
  const retry = onRetry ? () => onRetry(item) : ctx ? () => ctx.retry(item.id) : undefined;
  const content = (remove: ReactNode, labelled?: string) =>
    typeof children === 'function' ? children(item) : (children ?? <FileUploadItemBody item={item} nameId={labelled} onRetry={retry} remove={remove} />);

  if (ctx && !onRemove && item.status !== 'rejected') {
    const body = content(
      <FileInputItemRemove file={item.file} aria-label={removeLabel(item)} className={removeClass}>
        <Icon name="xmark" size={16} sw={2.2} />
      </FileInputItemRemove>,
    );
    // Rendered by a FileUploadList: be its item's element. Placed by hand: an item of its own.
    if (slotProps) {
      const own = slotProps as { className?: string; style?: CSSProperties };
      return (
        <div {...slotProps} data-file-id={item.id} data-status={item.status} className={cn(own.className, fileUploadItemVariants(), className)} style={{ ...own.style, ...style }}>
          {body}
        </div>
      );
    }
    return (
      <FileInputItem file={item.file} data-file-id={item.id} data-status={item.status} className={cn(fileUploadItemVariants(), className)} style={style}>
        {body}
      </FileInputItem>
    );
  }

  const dismiss = onRemove
    ? () => onRemove(item)
    : ctx
      ? (event: MouseEvent<HTMLElement>) => {
          ctx.remove(item.id, { reason: 'remove-press', event: event.nativeEvent });
          // The row is gone; the trigger is where choosing again starts.
          ctx.inputController.focus();
        }
      : undefined;
  return (
    <div role="group" aria-labelledby={nameId} data-slot="file-upload-item" data-file-id={item.id} data-status={item.status} className={cn(fileUploadItemVariants(), className)} style={style}>
      {content(
        dismiss ? (
          <Button data-file-item-remove="" variant="quiet" size="icon-sm" aria-label={removeLabel(item)} onClick={dismiss}>
            <Icon name="xmark" size={16} sw={2.2} />
          </Button>
        ) : null,
        nameId,
      )}
    </div>
  );
}

export interface FileUploadListProps {
  /** Default: the context's files. */
  files?: readonly UploadFile[];
  /** Render a row yourself: return a `<FileUploadItem item={…} />` (its props and children are yours). */
  children?: (item: UploadFile) => ReactNode;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

const listClass = 'm-0 flex list-none flex-col gap-2 p-0';

/**
 * The files as `FileUploadItem`s. Inside a `FileUpload`, the listed files are the FileInput's list (one Tab stop) and the
 * files it turned away follow as a list of their own, each with its reason and a Dismiss button. Renders nothing
 * while empty.
 */
export function FileUploadList({ files, children, className, style, 'aria-label': ariaLabel = 'Files' }: FileUploadListProps) {
  const ctx = useFileUploadContext();
  const list = files ?? ctx?.files ?? [];
  const byFile = useMemo(() => new Map(list.filter((f) => f.status !== 'rejected').map((f) => [f.file, f])), [list]);
  if (!list.length) return null;
  const row = (item: UploadFile) => (children ? children(item) : <FileUploadItem item={item} />);

  if (!ctx || files) {
    return (
      <ul data-slot="file-upload-list" aria-label={ariaLabel} className={cn(listClass, className)} style={style}>
        {list.map((item) => (
          <li key={item.id} className="min-w-0">
            {row(item)}
          </li>
        ))}
      </ul>
    );
  }

  const rejected = list.filter((item) => item.status === 'rejected');
  return (
    <div data-slot="file-upload-list" className={cn('flex flex-col gap-2', className)} style={style}>
      {byFile.size ? (
        <FileInputList aria-label={ariaLabel} className={listClass}>
          <FileInputItem
            render={(props, state) => {
              const item = byFile.get(state.file);
              return <ListedRowContext value={props}>{item ? row(item) : null}</ListedRowContext>;
            }}
          />
        </FileInputList>
      ) : null}
      {rejected.length ? (
        <ul data-slot="file-upload-list-rejected" aria-label="Not added" className={listClass}>
          {rejected.map((item) => (
            <li key={item.id} className="min-w-0">
              {row(item)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
