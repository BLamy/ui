'use client';
import { createElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CommitDetails } from '@ui-sdk/core';
import type {
  FileInputChange, FileInputController, FileInputState, FileInputValueChangeDetails, FileInputValueChangeReason, FileRejection,
} from '@ui-sdk/core/file-input';
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle, type RenderProp } from '@ui-sdk/react/primitive';
import type { FileStatus, FileUploadRules, UploadFile } from '@/lib/file-upload-model';
import {
  countFiles, fileUpload, busyOf,
  type FileUploadAddResult, type FileUploadChangeOptions, type FileUploadOptions, type FileUploadRootState,
} from '@/lib/file-upload-primitive';

/* ══ useFileUpload — the file-upload primitive in React ══
   Keeps the rows behind a FileUpload and works through them. Choosing, dropping, pasting and the checks (type, size,
   count, your own `validate`) are UI SDK's FileInput: the hook hands it the rules and the files it holds
   (`inputProps`); the `fileUpload` primitive (lib/file-upload-primitive) queues what it takes, lists what it turns
   away as `rejected` rows with a reason, and hands the queued files to your `upload` function a few at a time. The
   list is controlled (`value` + `onValueChange(files, details)`) or not; every change to it, from a drop to an
   upload's progress tick, comes with a `reason` and can be refused with `details.cancel()`.

     const up = useFileUpload({ accept: ['image/*'], maxSize: 5 * MB, upload: xhrUpload('/api/upload') })
     <FileUpload state={up} />            // or UI SDK's own parts: <FileInput {...up.inputProps}>…</FileInput>
     up.add(files)      up.remove(id, { reason, event })      up.retry(id)      up.uploadAll()      up.clear()

   `add` runs files through the same FileInput (its controller), so it works while that FileInput is mounted. The
   FileInput renders the primitive's root as its own element (`inputProps.render`), which puts the list on the page:
   an agent can remove, retry, clear and start uploads, and leaving the page aborts what is in flight. A `controller`
   from `createFileUploadController()` calls the same methods from anywhere. Upload outcomes ("a.png uploaded", "b.png failed to upload") are announced politely, batched, never per
   progress tick. */

/** What `useFileUpload` hands a UI SDK `FileInput`: spread it on the root (`<FileInput {...up.inputProps}>`). */
export interface FileUploadInputProps {
  controller: FileInputController;
  /** The files the list holds, rejected rows left out. */
  value: File[];
  onValueChange: (value: File[], details: FileInputValueChangeDetails) => void;
  onReject: (rejected: FileRejection[], details: CommitDetails<FileInputValueChangeReason>) => void;
  accept?: string | readonly string[];
  maxSize?: number;
  minSize?: number;
  maxFiles?: number;
  /** Unless `maxFiles` is 1. */
  multiple: boolean;
  validate: (file: File) => string | null | undefined;
  announcement: (change: FileInputChange) => string | null;
  /** The list's root part, which the FileInput renders as its element: one element is both. */
  render: RenderProp<FileInputState>;
}

export interface FileUploadState {
  files: UploadFile[];
  /**
   * Runs files through the checks, like a drop, and lists them (sending them when `autoUpload`). Returns what
   * happened to each. Works while the FileInput the hook feeds (a `FileUpload`, or `<FileInput {...inputProps}>`)
   * is mounted.
   */
  add: (files: ArrayLike<File>) => FileUploadAddResult;
  /** Drops a row (by id or path); an upload in flight is aborted. Reason `imperative` unless you pass one. */
  remove: (id: string, options?: FileUploadChangeOptions) => boolean;
  /** Queues a failed upload again (even without `autoUpload`). Reason `retry`. */
  retry: (id: string, options?: FileUploadChangeOptions) => boolean;
  /** Empties the list, aborting everything in flight. Reason `clear`. */
  clear: (options?: FileUploadChangeOptions) => boolean;
  /** Starts every queued file (with `autoUpload` off), respecting the concurrency limit. */
  uploadAll: () => void;
  /** Whether anything is queued or sending. */
  busy: boolean;
  counts: Record<FileStatus, number>;
  /** The rules in force (for hints). */
  rules: Pick<FileUploadRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>;
  /** The FileInput's controller: `open()` the picker from any button, `focus()` the trigger. */
  inputController: FileInputController;
  /** Props for UI SDK's `FileInput` root. */
  inputProps: FileUploadInputProps;
}

/** The list's root, rendered by the FileInput as its own element (`render={<FileUploadRoot handle={…} />}`). */
function FileUploadRoot({ handle, ...props }: PartProps<'div', FileUploadRootState> & { handle: PrimitiveHandle<typeof fileUpload> }) {
  return usePart(handle, 'root', {}, props, 'div');
}

/**
 * The `fileUpload` primitive for a React component: its rows (re-rendering as they change), its methods, and the props
 * for the UI SDK `FileInput` it feeds.
 */
export function useFileUpload(options: FileUploadOptions = {}): FileUploadState {
  const handle = usePrimitive(fileUpload, options);
  const { instance, api } = handle;
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const read = useCallback(() => instance.get().value, [instance]);
  const stored = useSyncExternalStore(subscribe, read, read);
  const files = options.value ?? stored;

  const counts = useMemo(() => countFiles(files), [files]);
  const value = useMemo(() => files.filter((f) => f.status !== 'rejected').map((f) => f.file), [files]);
  const { accept, maxSize, minSize, maxFiles } = options;
  const rules = useMemo(() => ({ accept, maxSize, minSize, maxFiles }), [accept, maxSize, minSize, maxFiles]);
  const render = useMemo<RenderProp<FileInputState>>(() => createElement(FileUploadRoot, { handle }), [handle]);
  const inputProps = useMemo<FileUploadInputProps>(
    () => ({
      render,
      controller: api.input,
      value,
      onValueChange: api.receive,
      onReject: api.reject,
      validate: api.check,
      announcement: api.announcement,
      ...rules,
      multiple: maxFiles !== 1,
    }),
    [api, render, value, rules, maxFiles],
  );

  return {
    files,
    add: api.add,
    remove: api.remove,
    retry: api.retry,
    clear: api.clear,
    uploadAll: api.uploadAll,
    busy: busyOf(counts),
    counts,
    rules,
    inputController: api.input,
    inputProps,
  };
}

/**
 * An object URL for previewing a file (an image thumbnail), made when the component mounts and revoked when the
 * file changes or the component unmounts — so removing a row frees its preview. `undefined` until it exists and
 * wherever object URLs aren't available (server render, tests without `URL.createObjectURL`).
 */
export function useFilePreview(file: Blob | undefined, enabled = true): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!file || !enabled || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setUrl(undefined);
      return;
    }
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
    };
  }, [file, enabled]);
  return url;
}
