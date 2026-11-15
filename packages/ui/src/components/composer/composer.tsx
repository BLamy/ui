'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitbookEditor, type GitbookEditorProps } from '@brett_lamy/docstream-editor/editor';
import type { EditorAttachment } from '@brett_lamy/docstream-editor';
import { cva, type VariantProps } from 'class-variance-authority';
import { animateIn, announce, bindDrag, bindLayer, createFocusRecovery, dragThreshold, type ChangeDetails, type FocusRecovery } from '@ui-sdk/core';
import { createVelocityTracker, rubberBand } from '@ui-sdk/core/gesture';
import { FileInput, FileInputDropzone, FileInputTrigger, type FileInputValueChangeDetails, type FileRejection } from '@ui-sdk/react/file-input';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as ToggleButton } from '@ui-sdk/react/toggle';
import { Button, buttonVariants, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
  type DropdownMenuProps,
} from '@/components/ui/dropdown-menu';
import { Separator, type SeparatorProps } from '@/components/ui/separator';
import { cn, cx, pressable } from '@/lib/utils';
import { Chevron, Icon, type IconName } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { looksLikeMarkdown, insertMarkdown } from '@/components/ui/markdown-editor';
import { ImageAnnotator, useImageAnnotatorEngine, type ImageAnnotatorEngine } from '@/components/ui/pencilkit/image-annotator';
import { animate } from 'framer-motion';
import { useToast } from '@/components/ui/toast';
import {
  acceptsFile,
  attachmentFileName,
  attachmentKind,
  describeAccepted,
  fileExtension,
  formatFileSize,
  readFileAsDataURL,
  textExcerpt,
  videoPoster,
  type ComposerAttachmentKind,
} from '@/components/ui/composer/composer-files';
import { flipPlay, flipSnapshot, prefersReducedMotion, springs, type FlipSnapshot } from '@/lib/motion';
import { useEnterExit, usePresence, usePresenceList, type PresenceEntry } from '@/lib/presence';
import { Swap } from '@/components/ui/swap';
import { TextMorph } from '@/components/ui/text-morph';
import { themeScopeProps } from '@/lib/theme';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';
import { useControllableChange } from '@/lib/controllable-state';

/* ══ Composer — a compositional prompt box, in the spirit of shadcn's InputGroup ══

   <Composer onSubmit={(markdown, attachments) => …} streaming={busy} onStop={stop}>
     <ComposerBump side="top">…</ComposerBump>            ← bumps lay out by `side`, wherever they are placed
     <ComposerCard>
       <ComposerAttachments />                              ← block-start addon
       <ComposerInput placeholder="Ask anything" />
       <ComposerExpand />
       <ComposerFooter>                                      ← block-end addon
         <ComposerSelect aria-label="Effort" items={…} /> <ComposerSeparator /> <ComposerSelect … />
         <ComposerSpacer /> <ComposerAdd icon="paperclip-diagonal" label="Attach files" /> <ComposerSend />
       </ComposerFooter>
     </ComposerCard>
     <ComposerBump side="bottom">…</ComposerBump>
   </Composer>

   The root owns the draft (markdown + attachments), expanded, streaming, disabled and send/stop; every part reads
   it from `useComposer()`. Popups, menus and buttons are the kit's own (DropdownMenu, Button, ImageAnnotator).
   `ComposerOutlet` (not in the barrel) lets an ancestor add parts to (or wrap the card of) the Composer inside it:
   the floating chat layout uses it to hang its transcript off a draggable top bump. */

export type { ComposerAttachmentKind } from '@/components/ui/composer/composer-files';

/**
 * A file in the draft. Images are data URLs (they chip into the editor and can be annotated); other files keep
 * an object URL in `src` (revoked when removed, or when the Composer unmounts) and show as tiles.
 */
export interface ComposerAttachment extends EditorAttachment {
  /** What it is, for its tile (derived from `type` / `name` when missing). */
  kind?: ComposerAttachmentKind;
  /** The picked, dropped or pasted file (for uploading it). */
  file?: File;
  /** A still for the tile: a video's first frame, a document's first page (an image URL). */
  preview?: string;
  /** The first lines of a text or code file, for its tile. */
  excerpt?: string;
}

/** Where attached files came from. */
export type ComposerFileSource = 'picker' | 'drop' | 'paste' | 'api';

/** A file the Composer turned away, and why. */
export interface ComposerFileRejection {
  file: File;
  /** `type`: not in `acceptedFileTypes` · `size`: over `maxFileSize` · `count`: past `maxFiles`. */
  reason: 'type' | 'size' | 'count';
}

export interface ComposerAttachOptions {
  /** Where the files came from (passed to `onDropFiles`; default `api`). */
  source?: ComposerFileSource;
  /** A viewport point (e.g. a drop's) — image chips land there when it is over the editor, else at the caret. */
  point?: { x: number; y: number };
  /** The event behind it (a drop, a paste, a picker change), passed on in `onAttachmentsChange`'s details. */
  event?: Event;
}

/* Why each of the Composer's values changed: the `reason` in its change details. */
/** The draft: typed (`input-change`), cleared by a send, or set from code. */
export type ComposerValueChangeReason = 'input-change' | 'send' | 'imperative';
/** The attachments: files from the picker, a drop or a paste, one removed, an annotation saved, a send, or code. */
export type ComposerAttachmentsChangeReason = 'picker' | 'drop' | 'paste' | 'remove' | 'annotate' | 'send' | 'imperative';
/** The tall drafting mode: ComposerExpand pressed, or code. */
export type ComposerExpandedChangeReason = 'press' | 'imperative';
/** The collapse: the scroller moved, the FAB was pressed, or code. */
export type ComposerCollapsedChangeReason = 'scroll' | 'press' | 'imperative';
export type ComposerValueChangeDetails = ChangeDetails<ComposerValueChangeReason>;
/** How a ComposerQueue takes a draft sent while a reply streams: `false` when its `onItemsChange` refused it. */
type ComposerQueueTake = (markdown: string, attachments: ComposerAttachment[], event?: Event) => boolean;
export type ComposerAttachmentsChangeDetails = ChangeDetails<ComposerAttachmentsChangeReason>;
export type ComposerExpandedChangeDetails = ChangeDetails<ComposerExpandedChangeReason>;
export type ComposerCollapsedChangeDetails = ChangeDetails<ComposerCollapsedChangeReason>;

type ComposerEditor = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;

export interface ComposerContextValue {
  /** The draft as GitBook-flavored Markdown (attachment chips serialize as `![name](attachment:id)`). */
  value: string;
  /** Sets the draft (reason `imperative` unless given); `false` when the change was canceled or nothing changed. */
  setValue: (markdown: string, given?: ChangeGiven<ComposerValueChangeReason>) => boolean;
  attachments: ComposerAttachment[];
  addAttachment: (attachment: ComposerAttachment, given?: ChangeGiven<ComposerAttachmentsChangeReason>) => boolean;
  /** Drops an attachment and its chip in the editor (reason `remove` unless given). */
  removeAttachment: (id: string, given?: ChangeGiven<ComposerAttachmentsChangeReason>) => boolean;
  updateAttachment: (id: string, patch: Partial<ComposerAttachment>, given?: ChangeGiven<ComposerAttachmentsChangeReason>) => boolean;
  /**
   * Adds files as attachments, after the `acceptedFileTypes` / `maxFileSize` / `maxFiles` checks and the
   * `onDropFiles` hook. Images chip into the editor (at `point` when over it, else the caret); other files
   * become tiles with a preview where one is cheap (a video's first frame, a text file's first lines).
   */
  attachFiles: (files: File[], options?: ComposerAttachOptions) => void;
  /** The Composer's `acceptedFileTypes` (the add button and the drop zone use it). */
  acceptedFileTypes?: string[];
  expanded: boolean;
  setExpanded: (expanded: boolean, given?: ChangeGiven<ComposerExpandedChangeReason>) => boolean;
  streaming: boolean;
  /** Whether there is anything to send. */
  canSend: boolean;
  /**
   * Sends the draft (into the ComposerQueue while a reply streams). Pass the click or key behind it, for the changes'
   * details. A send empties the draft through `onValueChange('', { reason: 'send' })` and
   * `onAttachmentsChange([], { reason: 'send' })` before anything goes out: canceling either one (or the queue's
   * `onItemsChange`) refuses the send, and the draft stays as it was.
   */
  send: (event?: Event) => void;
  stop: () => void;
  /** Hands a message to `onSubmit` directly, bypassing the draft (a ComposerQueue feeding a queued message in). */
  submit: (markdown: string, attachments: ComposerAttachment[]) => void;
  /** A ComposerQueue is mounted: sending while streaming queues the draft instead of being held. */
  canQueue: boolean;
  /** Opens the ImageAnnotator for an image attachment (a plain preview when the annotator is opted out). */
  annotate: (id: string) => void;
  /** An annotator engine is in effect (PencilKit by default, the `annotator` prop, or an ImageAnnotatorProvider). */
  canAnnotate: boolean;
  /** The Docstream editor behind ComposerInput, once it has mounted. */
  editor: ComposerEditor | null;
  /** The root element; bumps measure against it. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** How far the composer is collapsed: the full card, a single-row pill, or a FAB. */
  collapsed: ComposerCollapse;
  setCollapsed: (collapsed: ComposerCollapse, given?: ChangeGiven<ComposerCollapsedChangeReason>) => boolean;
  /** The Composer's `disabled`: nothing can be typed, attached, chosen or sent. */
  disabled: boolean;
}

/** What the Composer's own parts read beside the public value: registrations and the outlet's hooks. */
export interface ComposerInternals extends ComposerContextValue {
  /** A ComposerQueue registers where queued drafts go. */
  setQueue: (queue: ComposerQueueTake | null) => void;
  /** ComposerInput registers its editor here. */
  setEditor: (editor: ComposerEditor | null) => void;
  /** Set by a ComposerOutlet above the root. */
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  /** Where ComposerOptions move to while compact. */
  optionsOutlet: HTMLElement | null;
  setOptionsOutlet: (el: HTMLElement | null) => void;
  /** The FAB the card folds into, when this composer can fold. */
  fab: { icon?: React.ReactNode; restore: (event?: React.MouseEvent) => void } | null;
}

/** `none`: the full card · `compact`: one row, options in the bottom bump · `fab`: a floating button. */
export type ComposerCollapse = 'none' | 'compact' | 'fab';

const ComposerContext = React.createContext<ComposerInternals | null>(null);

/** The nearest Composer's draft, attachments and state, and the actions on them. */
export function useComposer(): ComposerContextValue {
  return useComposerInternals();
}

/** The Composer's parts' own view of it (not in the barrel). */
export function useComposerInternals(): ComposerInternals {
  const ctx = React.useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within <Composer>');
  return ctx;
}

/* ── Outlet ── */
export interface ComposerOutletProps {
  /** Parts added to the Composer below this outlet, as if they were its first children (e.g. a top bump). */
  parts?: React.ReactNode;
  /** Wraps (or replaces) the Composer's card, e.g. to swap it for a status while an agent works. */
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  /** Classes merged into the Composer root. */
  className?: string;
  children?: React.ReactNode;
}
interface OutletValue {
  parts?: React.ReactNode;
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  className?: string;
}
const ComposerOutletContext = React.createContext<OutletValue | null>(null);

/** Lets an ancestor contribute parts to the nearest Composer inside it. The Composer consumes it, so
    Composers nested in those parts are unaffected. */
export function ComposerOutlet({ parts, renderCard, className, children }: ComposerOutletProps) {
  const value = React.useMemo(() => ({ parts, renderCard, className }), [parts, renderCard, className]);
  return <ComposerOutletContext.Provider value={value}>{children}</ComposerOutletContext.Provider>;
}

/* ── Root ── */
export interface ComposerProps {
  /** Controlled draft Markdown. */
  value?: string;
  defaultValue?: string;
  /** Called before the draft changes; `details.cancel()` keeps an uncontrolled draft as it was. */
  onValueChange?: (markdown: string, details: ComposerValueChangeDetails) => void;
  /** Controlled attachments (pasted, dropped, or picked files). */
  attachments?: ComposerAttachment[];
  defaultAttachments?: ComposerAttachment[];
  /** Called before the attachments change (`details.reason` says how); `details.cancel()` keeps them as they were. */
  onAttachmentsChange?: (attachments: ComposerAttachment[], details: ComposerAttachmentsChangeDetails) => void;
  /** Tall drafting mode. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean, details: ComposerExpandedChangeDetails) => void;
  /** An agent is replying: send is held and ComposerSend becomes a stop control. */
  streaming?: boolean;
  onStop?: () => void;
  /** Called with the trimmed Markdown (attachment chips as `attachment:` refs) and the attachments. */
  onSubmit?: (markdown: string, attachments: ComposerAttachment[]) => void;
  /** Nothing can be typed, attached, chosen or sent (a credit limit, a read-only thread). Sets `data-disabled`. */
  disabled?: boolean;
  /**
   * The drawing engine of the ImageAnnotator that opens when an image attachment is pressed. Defaults to the
   * nearest ImageAnnotatorProvider's, else `PencilKitAnnotator`; `null` opts out (pressing an image then opens a
   * plain preview).
   */
  annotator?: ImageAnnotatorEngine | null;
  /**
   * Files the composer takes — from the add button, a drop, or a paste — as MIME types, wildcards and
   * extensions (`['image/*', 'application/pdf', '.md']`). Default: any file. Others are turned away with a toast.
   */
  acceptedFileTypes?: string[];
  /** The largest file (bytes) the composer takes; larger ones are turned away with a toast. */
  maxFileSize?: number;
  /** How many attachments a draft can hold; files past it are turned away with a toast. */
  maxFiles?: number;
  /**
   * Sees every batch of files that passed the checks, before they attach (from `picker`, `drop`, `paste`, or
   * `api`). Return `false` to take them yourself (nothing attaches), or an array to attach those instead.
   */
  onDropFiles?: (files: File[], source: ComposerFileSource) => File[] | false | void;
  /** Called with the files turned away. Providing it replaces the default warning toast. */
  onFilesRejected?: (rejections: ComposerFileRejection[]) => void;
  /** Collapse state: the full card, a single-row `compact` pill, or a `fab`. */
  collapsed?: ComposerCollapse;
  defaultCollapsed?: ComposerCollapse;
  onCollapsedChange?: (collapsed: ComposerCollapse, details: ComposerCollapsedChangeDetails) => void;
  /**
   * A scroller beside the composer (a chat transcript). Scrolling away from its anchor (up, away from the
   * newest message, by default) collapses the composer to `compact`; with `collapseTo="fab"` a flick or a long
   * scroll away folds it into a FAB — the card morphing into the button as one shape. Scrolling back near the
   * anchor, or tapping the FAB, restores it. Never collapses while the composer has focus, an attachment, or the
   * annotator open, and never folds a draft or a reply into the FAB.
   */
  collapseOnScroll?: React.RefObject<HTMLElement | null>;
  /** How far scrolling collapses the composer (default `compact`). */
  collapseTo?: 'compact' | 'fab';
  /**
   * Which end of the scroller is "home". `bottom` (default, chats): the transcript rests at its newest
   * message, scrolling up collapses and scrolling back down restores. `top` (documents): the reverse.
   */
  collapseAnchor?: 'bottom' | 'top';
  /** Where the FAB sits along the composer's inline axis (default `end`). */
  fabAlign?: 'start' | 'center' | 'end';
  /** The FAB's icon (defaults to a compose glyph). */
  fabIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

const newId = () => 'att-' + Math.random().toString(36).slice(2, 12);

/** An attachment's kind: its own, else from its type and name (untyped legacy attachments are images). */
function resolveKind(a: ComposerAttachment): ComposerAttachmentKind {
  if (a.kind) return a.kind;
  const kind = attachmentKind(a.type, a.name);
  if (kind === 'other' && !a.type && (!a.src || a.src.startsWith('data:image/'))) return 'image';
  return kind;
}

export function Composer({
  value: valueProp,
  defaultValue = '',
  onValueChange,
  attachments: attachmentsProp,
  defaultAttachments = [],
  onAttachmentsChange,
  expanded: expandedProp,
  defaultExpanded = false,
  onExpandedChange,
  streaming = false,
  onStop,
  onSubmit,
  disabled = false,
  annotator: annotatorProp,
  acceptedFileTypes,
  maxFileSize,
  maxFiles,
  onDropFiles,
  onFilesRejected,
  collapsed: collapsedProp,
  defaultCollapsed = 'none',
  onCollapsedChange,
  collapseOnScroll,
  collapseTo = 'compact',
  collapseAnchor = 'bottom',
  fabAlign = 'end',
  fabIcon,
  children,
  className,
  style,
  ref,
}: ComposerProps) {
  const outlet = React.useContext(ComposerOutletContext);
  const contextAnnotator = useImageAnnotatorEngine();
  const annotator = annotatorProp === undefined ? contextAnnotator : annotatorProp;
  const [value, setValue] = useControllableChange<string, ComposerValueChangeReason>(valueProp, defaultValue, onValueChange);
  const [attachments, setAttachments] = useControllableChange<ComposerAttachment[], ComposerAttachmentsChangeReason>(attachmentsProp, defaultAttachments, onAttachmentsChange);
  const [expanded, setExpanded] = useControllableChange<boolean, ComposerExpandedChangeReason>(expandedProp, defaultExpanded, onExpandedChange);
  const [collapsed, setCollapsed] = useControllableChange<ComposerCollapse, ComposerCollapsedChangeReason>(collapsedProp, defaultCollapsed, onCollapsedChange);
  const [editor, setEditor] = useState<ComposerEditor | null>(null);
  // The attachment in the lightbox, and whether it is open: the lightbox stays until its exit has played.
  const [annotating, setAnnotating] = useState<string | null>(null);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const savedAnnotation = useRef<string | null>(null);
  const [optionsOutlet, setOptionsOutlet] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const attRef = useRef(attachments);
  attRef.current = attachments;

  const canSend = !!(value.trim() || attachments.length);

  const addAttachment = React.useCallback(
    (a: ComposerAttachment, given?: ChangeGiven<ComposerAttachmentsChangeReason>) =>
      setAttachments((all) => (all.some((x) => x.id === a.id) ? all : [...all, a]), given),
    [setAttachments],
  );
  const updateAttachment = React.useCallback(
    (id: string, patch: Partial<ComposerAttachment>, given?: ChangeGiven<ComposerAttachmentsChangeReason>) =>
      setAttachments((all) => all.map((a) => (a.id === id ? { ...a, ...patch } : a)), given),
    [setAttachments],
  );
  // A send clears the editor: the input and chip removals that clearing echoes back are part of the send.
  const clearing = useRef(false);
  // The chip being taken out with its attachment: the editor reports that removal back, and it's already done.
  const unchipping = useRef<string | null>(null);
  const removeAttachment = (id: string, given: ChangeGiven<ComposerAttachmentsChangeReason> = { reason: 'remove' }) => {
    if (clearing.current || unchipping.current === id) return false;
    // Asked first: a canceled removal keeps the tile and its chip.
    const listed = attRef.current.some((a) => a.id === id);
    if (listed && !setAttachments((all) => all.filter((a) => a.id !== id), given)) return false;
    unchipping.current = id;
    try {
      editor?.commands.removeAttachment(id);
    } finally {
      unchipping.current = null;
    }
    return listed;
  };
  const setDraft = React.useCallback(
    (markdown: string, given?: ChangeGiven<ComposerValueChangeReason>) => (clearing.current ? false : setValue(markdown, given)),
    [setValue],
  );

  // ── files ──
  // Object URLs for non-image files: revoked once their attachment leaves the draft (removed, or replaced by a
  // controlled parent). Sent ones belong to onSubmit's receiver until the Composer unmounts.
  const objectUrls = useRef(new Map<string, string>());
  const sentUrls = useRef<string[]>([]);
  // Files still being read, so `maxFiles` counts them.
  const pendingFiles = useRef(0);
  React.useEffect(() => {
    const live = new Set(attachments.map((a) => a.id));
    objectUrls.current.forEach((url, id) => {
      if (live.has(id)) return;
      URL.revokeObjectURL(url);
      objectUrls.current.delete(id);
    });
  }, [attachments]);
  React.useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
      sentUrls.current.forEach((url) => URL.revokeObjectURL(url));
      sentUrls.current = [];
    },
    [],
  );
  const toast = useToast();
  const rejectFiles = (rejections: ComposerFileRejection[]) => {
    if (!rejections.length) return;
    if (onFilesRejected) return onFilesRejected(rejections);
    const names = (rs: ComposerFileRejection[]) => {
      const list = rs.map((r) => r.file.name || 'a file');
      const shown = list.slice(0, 2).join(list.length === 2 ? ' and ' : ', ');
      return list.length > 2 ? `${shown} and ${list.length - 2} more` : shown;
    };
    const group = (reason: ComposerFileRejection['reason']) => rejections.filter((r) => r.reason === reason);
    const [type, size, count] = [group('type'), group('size'), group('count')];
    const are = (rs: unknown[]) => (rs.length > 1 ? 'are' : 'is');
    const lines = [
      type.length && `${names(type)} ${are(type)} not a type this composer takes (${describeAccepted(acceptedFileTypes)}).`,
      size.length && `${names(size)} ${are(size)} over the ${formatFileSize(maxFileSize)} limit.`,
      count.length && `${names(count)} didn't fit — a draft holds ${maxFiles} attachment${maxFiles === 1 ? '' : 's'}.`,
    ].filter(Boolean);
    const n = rejections.length;
    toast.warning(n === 1 ? "Couldn't attach a file" : `Couldn't attach ${n} files`, {
      id: 'composer-files-rejected',
      description: lines.join(' '),
    });
  };
  // Image chips go in one step (like the editor's own paste): a space before them if they would touch a word.
  const insertChips = (items: { id: string; name: string }[], at?: number) => {
    const ed = editor;
    if (!ed || ed.isDestroyed || !items.length) return;
    const pos = at === undefined ? undefined : Math.min(at, ed.state.doc.content.size);
    const $at = pos === undefined ? ed.state.selection.$from : ed.state.doc.resolve(pos);
    const before = $at.parent.isTextblock ? $at.parent.textBetween(Math.max(0, $at.parentOffset - 1), $at.parentOffset, '', '\uFFFC') : '';
    const content = [
      ...(before && !/\s/.test(before) ? [{ type: 'text', text: ' ' }] : []),
      ...items.flatMap(({ id, name }) => [{ type: 'gbAttachment', attrs: { id, name } }, { type: 'text', text: ' ' }]),
    ];
    const chain = ed.chain().focus();
    (pos === undefined ? chain.insertContent(content) : chain.insertContentAt(pos, content)).run();
  };
  const attachFiles = (incoming: File[], { source = 'api', point, event }: ComposerAttachOptions = {}) => {
    if (disabled) return;
    const rejected: ComposerFileRejection[] = [];
    let files = incoming.filter((file) => {
      if (!acceptsFile(file, acceptedFileTypes)) rejected.push({ file, reason: 'type' });
      else if (maxFileSize != null && file.size > maxFileSize) rejected.push({ file, reason: 'size' });
      else return true;
      return false;
    });
    if (maxFiles != null) {
      const room = Math.max(0, maxFiles - attRef.current.length - pendingFiles.current);
      files.slice(room).forEach((file) => rejected.push({ file, reason: 'count' }));
      files = files.slice(0, room);
    }
    rejectFiles(rejected);
    if (files.length && onDropFiles) {
      const picked = onDropFiles(files, source);
      if (picked === false) files = [];
      else if (Array.isArray(picked)) files = picked;
    }
    if (!files.length) return;

    const items = files.map((file) => {
      const kind = attachmentKind(file.type, file.name);
      return { file, kind, id: newId(), name: attachmentFileName(file, kind === 'image' ? 'image.png' : 'file') };
    });
    // Images chip into the editor: where they were dropped when that is over it, else at the caret.
    const images = items.filter((i) => i.kind === 'image');
    let at: number | undefined;
    if (point && editor && !editor.isDestroyed) {
      const hit = typeof document !== 'undefined' ? document.elementFromPoint(point.x, point.y) : null;
      if (hit && editor.view.dom.contains(hit)) at = editor.view.posAtCoords({ left: point.x, top: point.y })?.pos;
    }
    insertChips(images, at);
    // Screen readers hear what a drop, paste or pick attached.
    announce(`Attached ${files.length === 1 ? items[0].name : `${files.length} files`}.`);
    const given: ChangeGiven<ComposerAttachmentsChangeReason> = { reason: source === 'api' ? 'imperative' : source, event };
    for (const { file, kind, id, name } of items) {
      const base: ComposerAttachment = { id, name, size: file.size, type: file.type, kind, file };
      pendingFiles.current++;
      const settle = (a: ComposerAttachment) => {
        pendingFiles.current--;
        // A canceled image takes its chip back out of the editor.
        if (!addAttachment(a, given) && kind === 'image' && !attRef.current.some((x) => x.id === id)) editor?.commands.removeAttachment(id);
      };
      if (kind === 'image') {
        readFileAsDataURL(file).then((src) => settle({ ...base, src }), () => settle(base));
        continue;
      }
      const src = URL.createObjectURL(file);
      objectUrls.current.set(id, src);
      // Previews are cheap (a few KB read, one decoded frame): the tile arrives with its face rather than
      // swapping it in — a video that can't be decoded in time keeps its glyph.
      if (kind === 'text') textExcerpt(file).then((excerpt) => settle({ ...base, src, excerpt }));
      else if (kind === 'video') videoPoster(src, { timeout: 2500 }).then((preview) => settle({ ...base, src, preview }));
      else settle({ ...base, src });
    }
  };

  // A mounted ComposerQueue takes drafts sent while a reply streams.
  const queueRef = useRef<ComposerQueueTake | null>(null);
  const [canQueue, setCanQueue] = useState(false);
  const setQueue = React.useCallback((queue: ComposerQueueTake | null) => {
    queueRef.current = queue;
    setCanQueue(!!queue);
  }, []);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const submit = React.useCallback((markdown: string, sent: ComposerAttachment[]) => submitRef.current?.(markdown, sent), []);

  const send = (event?: Event) => {
    if (!canSend || disabled) return;
    const queue = streaming ? queueRef.current : null;
    if (streaming && !queue) return;
    const draft = valueRef.current;
    const markdown = draft.trim();
    const sent = attRef.current;
    // The draft empties first, as the send's own changes: a canceled one refuses the send, and what was already
    // emptied comes back, so the draft, its attachments and the editor stay as they were.
    if (draft && !setValue('', { reason: 'send', event })) return;
    const putBack = () => {
      if (draft) setValue(draft, { reason: 'imperative' });
    };
    if (sent.length && !setAttachments([], { reason: 'send', event })) {
      putBack();
      return;
    }
    if (queue && !queue(markdown, sent, event)) {
      putBack();
      if (sent.length) setAttachments(sent, { reason: 'imperative' });
      return;
    }
    // The receiver owns the sent files' URLs now; they stay valid until this Composer unmounts.
    for (const a of sent) {
      const url = objectUrls.current.get(a.id);
      if (!url) continue;
      sentUrls.current.push(url);
      objectUrls.current.delete(a.id);
    }
    clearing.current = true;
    try {
      if (editor) editor.commands.clearContent(true);
    } finally {
      clearing.current = false;
    }
    if (!queue) onSubmit?.(markdown, sent);
  };
  const stop = () => {
    onStop?.();
  };

  // ── scroll-linked collapse ──
  // Chat-style by default: the transcript rests at its newest message (the bottom). Scrolling away from it
  // folds the composer to one row; a long or fast scroll away folds it to the FAB; coming back near the
  // anchor restores it. `collapseAnchor="top"` flips this for documents that start at the top.
  const scrollState = useRef({ collapsed, collapseTo, streaming, draft: false, blocked: () => false as boolean, set: setCollapsed });
  scrollState.current = {
    collapsed,
    collapseTo,
    streaming,
    draft: !!value.trim(),
    blocked: () =>
      !!annotating ||
      attachments.length > 0 ||
      !!(rootRef.current && typeof document !== 'undefined' && rootRef.current.contains(document.activeElement)),
    set: setCollapsed,
  };
  React.useEffect(() => {
    const scroller = collapseOnScroll?.current;
    if (!scroller) return;
    // Distance from the anchor edge (the newest message, for chats).
    const away = () =>
      collapseAnchor === 'top' ? scroller.scrollTop : scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    let previous = away();
    let travel = 0;
    // The speed away from the anchor over the last ~100ms (a flick), from UI SDK's velocity tracker.
    const tracker = createVelocityTracker({ horizon: COLLAPSE_FLICK_WINDOW });
    tracker.add(performance.now(), previous);
    const onScroll = (event: Event) => {
      const now = performance.now();
      const d = away();
      const delta = d - previous; // > 0: moving away from the anchor
      previous = d;
      tracker.add(now, d);
      const speed = tracker.velocity(now);
      const st = scrollState.current;
      const set = (next: ComposerCollapse) => st.set(next, { reason: 'scroll', event });
      // At (or near) the anchor: the full composer.
      if (d < COLLAPSE_NEAR_ANCHOR) {
        travel = 0;
        if (st.collapsed !== 'none') set('none');
        return;
      }
      if (delta < 0) {
        // Heading back: a FAB opens up to the row on the way, so there is something to type into.
        travel = Math.min(0, travel) + delta;
        if (st.collapsed === 'fab' && travel < -160) set('compact');
        return;
      }
      if (delta === 0) return;
      if (st.blocked()) {
        travel = 0;
        return;
      }
      travel = Math.max(0, travel) + delta;
      // Drafts and replies never fold into the FAB.
      const canFab = st.collapseTo === 'fab' && !st.streaming && !st.draft;
      // A flick (fast) or a long read away folds all the way to the FAB.
      if (canFab && st.collapsed !== 'fab' && (speed > COLLAPSE_FLICK_SPEED || travel > COLLAPSE_FAB_TRAVEL)) set('fab');
      else if (st.collapsed === 'none' && travel > 24) set('compact');
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [collapseOnScroll, collapseAnchor]);

  // ── one shape, many states ──
  // Full ↔ compact ↔ FAB ↔ tall are the same card changing shape: its size springs from the old to the new,
  // the controls that moved (options into the bump, send into the row) fly from where they were, and the
  // bumps fold away or come back. The DOM is read during render (before React commits) and played back in a
  // layout effect, so a change arriving mid-flight starts from wherever things are.
  const shapeKey = `${collapsed}|${expanded}`;
  const committedShape = useRef(shapeKey);
  const shapeSnap = useRef<ShapeSnapshot | null>(null);
  if (shapeKey !== committedShape.current && !shapeSnap.current && typeof window !== 'undefined') {
    shapeSnap.current = snapshotShape(rootRef.current);
  }
  React.useLayoutEffect(() => {
    committedShape.current = shapeKey;
    const snap = shapeSnap.current;
    shapeSnap.current = null;
    if (snap && !prefersReducedMotion()) playShape(rootRef.current, snap);
  }, [shapeKey]);

  const restore = (event?: React.MouseEvent) => {
    if (!setCollapsed('none', { reason: 'press', event: event?.nativeEvent })) return;
    requestAnimationFrame(() => editor?.commands.focus('end'));
  };
  const fabEnabled = !!collapseOnScroll || collapsedProp !== undefined || defaultCollapsed === 'fab' || collapseTo === 'fab';
  const origin = useRef<(() => HTMLElement | null) | undefined>(undefined);
  const pressedAttachment = useRef<Element | null>(null);
  const openAnnotator = (id: string) => {
    // Annotation is for images; other files open from their tiles.
    const target = attRef.current.find((a) => a.id === id);
    if (target && resolveKind(target) !== 'image') return;
    // The lightbox zooms out of the thumbnail (or the inline chip) and lands back in it.
    const esc = typeof CSS !== 'undefined' ? CSS.escape(id) : id;
    const pressed = pressedAttachment.current;
    origin.current = () => {
      // The thing that was pressed (a strip thumbnail or an inline chip), else the strip thumbnail.
      const el =
        pressed?.isConnected && pressed.getAttribute('data-attachment-id') === id
          ? pressed
          : rootRef.current?.querySelector(`[data-slot="composer-attachment"][data-attachment-id="${esc}"]`);
      return (el?.querySelector('img') ?? el ?? null) as HTMLElement | null;
    };
    setAnnotating(id);
    setAnnotateOpen(true);
  };

  const ctx: ComposerInternals = {
    value,
    setValue: setDraft,
    attachments,
    addAttachment,
    removeAttachment,
    updateAttachment,
    attachFiles,
    acceptedFileTypes,
    expanded,
    setExpanded,
    streaming,
    canSend,
    send,
    stop,
    submit,
    canQueue,
    setQueue,
    annotate: openAnnotator,
    canAnnotate: !!annotator,
    editor,
    setEditor,
    rootRef,
    renderCard: outlet?.renderCard,
    collapsed,
    setCollapsed,
    optionsOutlet,
    setOptionsOutlet,
    fab: fabEnabled ? { icon: fabIcon, restore } : null,
    disabled,
  };
  const annotated = annotating ? attachments.find((a) => a.id === annotating) : undefined;

  return (
    <ComposerContext.Provider value={ctx}>
      {/* The outlet applies to this Composer only. */}
      <ComposerOutletContext.Provider value={null}>
        <div
          ref={(el) => {
            rootRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          }}
          data-slot="composer"
          data-streaming={streaming || undefined}
          data-expanded={expanded || undefined}
          data-collapsed={collapsed}
          data-fab-align={fabAlign}
          data-disabled={disabled || undefined}
          onPointerDownCapture={(event) => {
            pressedAttachment.current = (event.target as Element).closest?.('[data-attachment-id]') ?? null;
          }}
          className={cn('group/composer relative box-border flex w-full min-w-0 flex-col', outlet?.className, className)}
          style={style}
        >
          {/* In `fab` the bumps fold away and the card itself becomes the round button — one shape throughout. */}
          <div data-slot="composer-stack" className="flex min-w-0 flex-col">
            {outlet?.parts}
            {children}
          </div>
        </div>
        {annotated?.src ? (
          <ImageAnnotator
            key={annotated.id}
            src={annotated.src}
            engine={annotator}
            origin={origin.current}
            open={annotateOpen}
            onOpenChange={setAnnotateOpen}
            onOpenChangeComplete={(open) => {
              if (open) return;
              // The flattened image replaces the attachment once the old one has landed back in its thumbnail.
              const saved = savedAnnotation.current;
              savedAnnotation.current = null;
              if (saved) updateAttachment(annotated.id, { src: saved, type: 'image/png' }, { reason: 'annotate' });
              setAnnotating(null);
            }}
            onSave={(src) => {
              savedAnnotation.current = src;
            }}
          />
        ) : null}
      </ComposerOutletContext.Provider>
    </ComposerContext.Provider>
  );
}

/* ── Shape morph (FLIP) ── */
/** Distance from the anchor (px) inside which scrolling restores the full composer. */
const COLLAPSE_NEAR_ANCHOR = 72;
/** Scroll speed away from the anchor (px/ms) that counts as a flick straight to the FAB. */
const COLLAPSE_FLICK_SPEED = 2;
/** The window (ms) a flick's speed is measured over. */
const COLLAPSE_FLICK_WINDOW = 100;
/** Distance away from the anchor (px) that folds to the FAB without a flick. */
const COLLAPSE_FAB_TRAVEL = 420;

/** Controls that fly to their new place when the composer changes shape. */
const FLIP_CONTROLS =
  '[data-slot="composer-footer"] > :not([data-slot="composer-spacer"]):not([data-slot="composer-options-home"]), [data-slot="composer-options"] > *, [data-composer-expand]';

interface ShapeSnapshot {
  card: DOMRect;
  controls: FlipSnapshot;
  bumps: Map<HTMLElement, number>;
}

const morphToken = new WeakMap<Element, number>();

function stackBumps(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>(':scope > [data-slot="composer-stack"] > [data-slot="composer-bump"]') ?? []);
}

function snapshotShape(root: HTMLElement | null): ShapeSnapshot | null {
  const card = root?.querySelector<HTMLElement>('[data-slot="composer-card"]');
  if (!root || !card) return null;
  return {
    card: card.getBoundingClientRect(),
    controls: flipSnapshot(root.querySelectorAll(FLIP_CONTROLS)),
    bumps: new Map(stackBumps(root).map((b) => [b, b.getBoundingClientRect().height] as const)),
  };
}

function playShape(root: HTMLElement | null, snap: ShapeSnapshot) {
  const card = root?.querySelector<HTMLElement>('[data-slot="composer-card"]');
  if (!root || !card) return;
  const spring = springs.smooth;
  // Bumps first (their final heights settle the card's final place).
  const bumpAfter = new Map<HTMLElement, number>();
  snap.bumps.forEach((_, bump) => {
    if (!bump.isConnected) return;
    bump.style.height = '';
    bumpAfter.set(bump, bump.getBoundingClientRect().height);
  });
  card.style.width = '';
  card.style.height = '';
  card.style.transform = '';
  const after = card.getBoundingClientRect();
  const from = snap.card;
  // Where the card's box sits while it still has its old size (a FAB anchors to its end, a row to its top).
  card.style.width = `${from.width}px`;
  card.style.height = `${from.height}px`;
  snap.bumps.forEach((before, bump) => bump.isConnected && (bump.style.height = `${before}px`));
  const held = card.getBoundingClientRect();
  const token = (morphToken.get(card) ?? 0) + 1;
  morphToken.set(card, token);
  animate(
    card,
    { width: [from.width, after.width], height: [from.height, after.height], x: [from.left - held.left, 0], y: [from.top - held.top, 0] },
    {
      ...spring,
      onComplete: () => {
        // A newer morph owns the card now.
        if (morphToken.get(card) !== token) return;
        card.style.width = '';
        card.style.height = '';
        card.style.transform = '';
      },
    },
  );
  snap.bumps.forEach((before, bump) => {
    const to = bumpAfter.get(bump);
    if (to == null) return;
    if (Math.abs(to - before) < 1) {
      bump.style.height = '';
      return;
    }
    morphToken.set(bump, token);
    animate(bump, { height: [before, to] }, { ...spring, onComplete: () => morphToken.get(bump) === token && (bump.style.height = '') });
  });
  // Controls inside the card move relative to it; options that changed parents fly in page space.
  const inCard: FlipSnapshot = new Map();
  const moved: FlipSnapshot = new Map();
  snap.controls.forEach((rect, el) => {
    const option = el.parentElement?.getAttribute('data-slot') === 'composer-options';
    const wasInCard = rect.top >= from.top - 1 && rect.bottom <= from.bottom + 1;
    const nowInCard = card.contains(el);
    (option && wasInCard !== nowInCard ? moved : inCard).set(el, rect);
  });
  // Measure the controls against the card at its final size, then let the card spring from its old one.
  card.style.width = '';
  card.style.height = '';
  flipPlay(inCard, { relativeTo: [from, after] });
  flipPlay(moved, { lift: true });
  card.style.width = `${from.width}px`;
  card.style.height = `${from.height}px`;
}

/* ── FAB ── */
/** On a touch screen every composer control answers presses 44px wide, without changing the drawn size. */
const touchTarget = "relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-1/2 pointer-coarse:after:content-['']";

/* ── Options that move between the footer and the bottom bump ── */
/** The options row: one line that scrolls sideways when the footer is too narrow (no wrapped, orphaned pills). It
    grows to its content, and gives the rest of the row to the ComposerSpacer after it. */
const OPTIONS_ROW =
  'flex min-w-0 max-w-max shrink grow-[999] basis-0 items-center gap-[5px] overflow-x-auto -m-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export interface ComposerOptionsProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The option pills (ComposerSelect, a model picker, ComposerSeparator between groups). */
  children?: React.ReactNode;
}

/**
 * The option pills (model, effort, access…). They render in place — the footer — and, while the composer is
 * `compact`, move into the `ComposerOptionsOutlet` (e.g. in the bottom bump). The same elements move (a stable
 * portal host is re-attached), so menus keep their state.
 */
export function ComposerOptions({ className, style, children, ...props }: ComposerOptionsProps) {
  const { collapsed, optionsOutlet } = useComposerInternals();
  const home = useRef<HTMLSpanElement>(null);
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('span');
    el.setAttribute('data-slot', 'composer-options');
    return el;
  });
  // The host is a plain element the Composer moves around: its classes and props are written on it directly.
  React.useLayoutEffect(() => {
    if (!host) return;
    host.className = cn(OPTIONS_ROW, className);
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'string' && (key.startsWith('data-') || key.startsWith('aria-') || key === 'id' || key === 'role')) host.setAttribute(key, value);
    }
    if (style) Object.assign(host.style, style);
  });
  React.useLayoutEffect(() => {
    const target = collapsed === 'compact' && optionsOutlet ? optionsOutlet : home.current;
    if (host && target && host.parentNode !== target) target.appendChild(host);
  }, [collapsed, optionsOutlet, host]);
  React.useEffect(() => () => host?.remove(), [host]);
  return (
    <>
      <span ref={home} data-slot="composer-options-home" className="contents" />
      {host ? createPortal(children, host) : null}
    </>
  );
}

export interface ComposerOptionsOutletProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  ref?: React.Ref<HTMLSpanElement>;
}

/** Where ComposerOptions go while the composer is compact (typically in the bottom bump), after a separator. */
export function ComposerOptionsOutlet({ className, ref, ...props }: ComposerOptionsOutletProps) {
  const { collapsed, setOptionsOutlet } = useComposerInternals();
  const compact = collapsed === 'compact';
  const setRef = React.useCallback(
    (el: HTMLSpanElement | null) => {
      setOptionsOutlet(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [setOptionsOutlet, ref],
  );
  return (
    <>
      {compact ? <ComposerSeparator /> : null}
      <span
        ref={setRef}
        data-slot="composer-options-outlet"
        className={cn(compact ? 'contents' : 'hidden', className)}
        {...props}
      />
    </>
  );
}

/* ── Card ── */
export const composerCardVariants = cva(
  // Addons order themselves (block-start → inline-start → input → inline-end → block-end), so hosts can place
  // them in any order. z-1 keeps the card over a tucked top bump.
  [
    'group/composer-card relative z-1 box-border flex min-w-0 flex-wrap items-center border border-border bg-card shadow-raised',
    // Folded into the FAB, the card sits where the Composer's `fabAlign` says.
    'group-data-[fab-align=start]/composer:data-folded:self-start group-data-[fab-align=center]/composer:data-folded:self-center group-data-[fab-align=end]/composer:data-folded:self-end',
  ],
  {
    variants: {
      size: {
        /** The Workbench composer: card corners. */
        default: 'rounded-card',
        /** A rounder card (T3 Code): sheet corners. */
        lg: 'rounded-sheet',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export interface ComposerCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof composerCardVariants> {
  /**
   * The card is a drop zone for files (default, UI SDK's FileInputDropzone): drag files from the OS onto it and
   * they attach; a drop overlay springs in while they hover. Files pasted while focus is in the card attach too.
   * Only file drags reach it, so text dragged inside the editor keeps the editor's handling. `false` opts out.
   */
  dropZone?: boolean;
  /** The overlay's title while files hover (default "Drop to attach"). */
  dropLabel?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** The composer takes every file at the door; `attachFiles` turns away what it doesn't take, with a toast. */
const NO_FILES: File[] = [];
const silent = () => null;

/** Where the files of a FileInput change go: through `attachFiles`, which checks them. A drop keeps its point. */
function takeFiles(attachFiles: ComposerContextValue['attachFiles'], files: File[], details: FileInputValueChangeDetails) {
  if (!files.length) return;
  const source: ComposerFileSource = details.reason === 'drop' || details.reason === 'paste' ? details.reason : 'picker';
  const event = details.event as DragEvent | undefined;
  // Keyboard and clipboard drops carry no point — they go to the caret.
  const point = source === 'drop' && event && (event.clientX || event.clientY) ? { x: event.clientX, y: event.clientY } : undefined;
  attachFiles(files, { source, point, event: details.event });
}

/** The card's drop overlay: a tinted wash and ring that spring in, the plus lifting into place. */
function ComposerDropOverlay({ dragging, label, hint }: { dragging: boolean; label?: React.ReactNode; hint: string }) {
  return (
    <div
      data-slot="composer-drop-overlay"
      data-dragging={dragging || undefined}
      aria-hidden="true"
      className={cn(
        'group/drop pointer-events-none absolute -inset-px z-4 flex items-center justify-center overflow-hidden rounded-[inherit] border-2 border-primary bg-[color-mix(in_srgb,var(--primary)_11%,var(--card))]',
        'invisible scale-[.985] opacity-0 transition-[opacity,scale,visibility] duration-spring-snappy ease-spring-snappy data-dragging:visible data-dragging:scale-100 data-dragging:opacity-100 motion-reduce:transition-none',
      )}
    >
      <div className="flex min-w-0 translate-y-2 items-center gap-2.5 px-4 opacity-0 transition-[translate,opacity] duration-spring-bouncy ease-spring-bouncy group-data-dragging/drop:translate-y-0 group-data-dragging/drop:opacity-100 motion-reduce:transition-none">
        <span className="grid size-8 shrink-0 scale-40 -rotate-90 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_var(--primary)] transition-[scale,rotate] duration-spring-bouncy ease-spring-bouncy group-data-dragging/drop:scale-100 group-data-dragging/drop:rotate-0 group-data-[collapsed=compact]/composer:size-6 motion-reduce:transition-none">
          <Icon name="plus" size={16} sw={2.6} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-footnote font-semibold text-foreground">{label ?? 'Drop to attach'}</span>
          <span className="truncate text-caption2 text-muted-foreground group-data-[collapsed=compact]/composer:hidden">{hint}</span>
        </span>
      </div>
    </div>
  );
}

/** The bordered surface. Holds the input and its addons, takes dropped and pasted files; an outlet may wrap it. */
export function ComposerCard({ size, dropZone = true, dropLabel, className, ref, children, ...props }: ComposerCardProps) {
  const { renderCard, collapsed, fab, acceptedFileTypes, attachFiles, disabled } = useComposerInternals();
  const folded = collapsed === 'fab' && !!fab;
  const surface = (dragging: boolean) => (
    <div
      ref={ref}
      data-slot="composer-card"
      data-folded={folded || undefined}
      data-drop-zone={(dropZone && !folded) || undefined}
      data-drop-target={dragging || undefined}
      className={cn(composerCardVariants({ size }), className)}
      {...props}
    >
      {/* Folded into the FAB, the card keeps its content (faded, inert) and shows the button face over it. */}
      <div data-slot="composer-card-body" className="contents" inert={folded || undefined} aria-hidden={folded || undefined}>
        {children}
      </div>
      {dropZone ? (
        <ComposerDropOverlay
          dragging={dragging}
          label={dropLabel}
          hint={acceptedFileTypes?.length ? describeAccepted(acceptedFileTypes) : 'Images, documents, code — any file'}
        />
      ) : null}
      {fab ? (
        // The face the card folds into (styles.css shows it while folded); the button fills it.
        <span data-slot="composer-fab" className="absolute inset-0 z-3 rounded-[inherit]">
          <SdkButton
            aria-label="Open composer"
            aria-hidden={!folded || undefined}
            tabIndex={folded ? undefined : -1}
            onClick={fab.restore}
            className={cn(pressable, pressableFocusRing, 'grid size-full cursor-pointer place-items-center rounded-[inherit] border-0 bg-transparent p-0 text-foreground')}
          >
            {fab.icon ?? <Icon name="square-pencil" size={21} sw={1.9} />}
          </SdkButton>
        </span>
      ) : null}
    </div>
  );
  const card = dropZone ? (
    // UI SDK's FileInput holds no files of its own: each drop or paste goes straight to `attachFiles`.
    <FileInput
      className="contents"
      multiple
      value={NO_FILES}
      onValueChange={(_, details) => takeFiles(attachFiles, details.added, details)}
      announcement={silent}
      disabled={folded || disabled}
    >
      <FileInputDropzone className="contents">{({ dragging }) => surface(dragging)}</FileInputDropzone>
    </FileInput>
  ) : (
    surface(false)
  );
  return <>{renderCard ? renderCard(card) : card}</>;
}

/* ── Addons ── */
export const composerAddonVariants = cva('box-border flex min-w-0 items-center gap-[5px]', {
  variants: {
    align: {
      'block-start': 'order-[-2] w-full px-3 pt-2.5',
      'inline-start': 'order-[-1] shrink-0 self-start pt-2 pl-2',
      'inline-end': 'order-1 shrink-0 self-start pt-2 pr-2',
      'block-end': 'order-2 w-full px-2 pt-1 pb-2',
    },
  },
  defaultVariants: { align: 'block-end' },
});

export interface ComposerAddonProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof composerAddonVariants> {
  ref?: React.Ref<HTMLDivElement>;
}

/** A row above/below the input (`block-*`) or a column beside it (`inline-*`), like InputGroupAddon. */
export function ComposerAddon({ align, className, ref, ...props }: ComposerAddonProps) {
  return <div ref={ref} data-slot="composer-addon" data-align={align ?? 'block-end'} className={cn(composerAddonVariants({ align }), className)} {...props} />;
}

/** The footer row: `ComposerAddon align="block-end"` that wraps its controls. While the composer is compact it
    becomes the inline-end column of the single row (its ComposerOptions move to the bump). */
export function ComposerFooter({ className, ...props }: Omit<ComposerAddonProps, 'align'>) {
  return (
    <ComposerAddon
      data-slot="composer-footer"
      align="block-end"
      className={cn(
        'flex-wrap group-data-[collapsed=compact]/composer:order-1 group-data-[collapsed=compact]/composer:[&>[data-slot=composer-spacer]]:hidden group-data-[collapsed=compact]/composer:w-auto group-data-[collapsed=compact]/composer:flex-nowrap group-data-[collapsed=compact]/composer:py-[7px] group-data-[collapsed=compact]/composer:pr-[7px] group-data-[collapsed=compact]/composer:pl-0',
        className,
      )}
      {...props}
    />
  );
}

/** Pushes the controls after it to the end of a row. */
export function ComposerSpacer({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="composer-spacer" aria-hidden="true" className={cn('flex-1', className)} {...props} />;
}

/** A thin vertical rule between footer pills (the kit's Separator, on UI SDK's). */
export function ComposerSeparator({ className, ...props }: Omit<SeparatorProps, 'orientation'>) {
  return <Separator orientation="vertical" className={cx('mx-0.5 h-4 self-center', className)} {...props} />;
}

/** Muted inline text with an optional leading icon (a bump's "Local checkout", a footer hint). */
export function ComposerText({
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { icon?: IconName | (string & {}) }) {
  return (
    <span data-slot="composer-text" className={cn('flex min-w-0 items-center gap-[7px] text-caption text-muted-foreground', className)} {...props}>
      {icon ? <Icon name={icon} size={13.5} sw={1.9} /> : null}
      {children}
    </span>
  );
}

/* ── Buttons ── */
/* The composer's buttons are the kit's Button: icon buttons are `variant="quiet" size="icon-sm"` (28px), the option
   pill is the same quiet look at the footer's density, and send / stop are `default` / `destructive` circles. */
const iconButtonClass = cn(buttonVariants({ variant: 'quiet', size: 'icon-sm' }), touchTarget);
const circleClass = 'size-[30px] rounded-full p-0';

/** The Composer around a part, when there is one (the pill and select also work on their own). */
function useComposerDisabled(disabled: boolean | undefined) {
  const composer = React.useContext(ComposerContext);
  return disabled ?? composer?.disabled ?? false;
}

export interface ComposerPillProps extends Omit<ButtonProps, 'variant' | 'size' | 'children'> {
  /** The label (what is chosen). */
  children?: React.ReactNode;
  /** Leading glyph: an `Icon` name or a node. */
  icon?: IconName | (string & {}) | React.ReactNode;
}

/**
 * An option pill: the kit's quiet Button at the footer's density, with an optional icon, its label (a changed label
 * morphs by the letters the two share) and a chevron. ComposerSelect's trigger; give it to any popup trigger
 * (`render={<ComposerPill icon="lock-rounded" />}`) to build your own picker. Color it with `className`.
 */
export function ComposerPill({ icon, disabled, className, children, ...props }: ComposerPillProps) {
  return (
    <Button
      variant="quiet"
      size="sm"
      disabled={useComposerDisabled(disabled)}
      className={cx(['h-auto gap-[5px] rounded-md px-[7px] py-[5px] text-caption font-semibold', touchTarget], className)}
      {...props}
    >
      {typeof icon === 'string' ? <Icon name={icon} size={13.5} sw={2} /> : icon}
      {typeof children === 'string' ? <TextMorph className="whitespace-nowrap">{children}</TextMorph> : <span className="whitespace-nowrap">{children}</span>}
      <Chevron direction="down" size={11} strokeWidth={2.4} className="opacity-60" />
    </Button>
  );
}

/* ── Select pill ── */
export interface ComposerSelectItem {
  value: string;
  label: string;
  /** What the pill shows while this item is chosen (default `label`). */
  short?: string;
  /** A second line under the label in the menu. */
  description?: React.ReactNode;
  disabled?: boolean;
}

/** What a ComposerSelect's `onValueChange` receives beside the value: the menu radio group's change details. */
export type ComposerSelectChangeDetails = Parameters<NonNullable<React.ComponentProps<typeof DropdownMenuRadioGroup>['onValueChange']>>[1];

export interface ComposerSelectProps extends Omit<DropdownMenuProps, 'items' | 'children'> {
  /** Names the choice ("Effort"); the pill is named "Effort: <what it shows>". */
  'aria-label': string;
  items: ComposerSelectItem[];
  value?: string;
  defaultValue?: string;
  /** A choice was made: its `value`, and UI SDK's change details (`reason`, `event`); `details.cancel()` keeps it. */
  onValueChange?: (value: string, details: ComposerSelectChangeDetails) => void;
  /** The pill can't be pressed (also when the Composer is `disabled`). */
  disabled?: boolean;
  /** Leading glyph on the pill: an `Icon` name or a node. */
  icon?: ComposerPillProps['icon'];
  /** Where the menu opens against the pill (default `top` / `start`). */
  side?: DropdownMenuContentProps['side'];
  align?: DropdownMenuContentProps['align'];
  /** Classes for the pill. */
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * An option pill that opens a small menu of choices (effort, access…): a preset of the kit's parts,
 *
 *   <DropdownMenu><DropdownMenuTrigger render={<ComposerPill />} />
 *     <DropdownMenuContent size="sm" side="top" align="start" palette="trigger">
 *       <DropdownMenuRadioGroup><DropdownMenuRadioItem description="…" />…
 *
 * so it looks and behaves like every kit menu, in the palette of the surface it opened from. Compose those parts
 * yourself for anything more (groups, icons, a search field).
 */
export function ComposerSelect({
  'aria-label': ariaLabel,
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled,
  icon,
  side = 'top',
  align = 'start',
  className,
  ref,
  ...props
}: ComposerSelectProps) {
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value ?? '');
  const value = valueProp ?? inner;
  const current = items.find((o) => o.value === value) ?? items[0];
  const shown = current?.short ?? current?.label ?? '';
  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger
        render={<ComposerPill ref={ref} icon={icon} disabled={disabled} aria-label={`${ariaLabel}: ${shown}`} className={className} />}
      >
        {shown}
      </DropdownMenuTrigger>
      <DropdownMenuContent size="sm" side={side} align={align} palette="trigger">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next, details) => {
            // The consumer hears it first: `details.cancel()` keeps an uncontrolled pill's value.
            onValueChange?.(next, details);
            if (!details.canceled && valueProp === undefined) setInner(next);
          }}
        >
          {items.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} label={o.label} description={o.description} disabled={o.disabled} closeOnSelect>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Send / stop / add / expand ── */
export interface ComposerStopProps extends Omit<ButtonProps, 'variant' | 'size'> {
  /** `ring`: a spinning progress ring with a stop square (Workbench); `solid`: a red circle (T3 Code). */
  variant?: 'ring' | 'solid';
  /** Render even when not streaming (to animate it yourself). */
  forceMount?: boolean;
}

/** The spinning progress ring around the stop square. */
function StopRing() {
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0 animate-[wbSpin_1s_linear_infinite] motion-reduce:animate-none">
      <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--secondary-strong, var(--accent))" strokeWidth="2.5" />
      <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="24 55" strokeLinecap="round" />
    </svg>
  );
}

/** Stops the reply. Renders only while streaming; pops in and out beside its neighbours. */
export function ComposerStop({ variant = 'ring', forceMount, className, ...props }: ComposerStopProps) {
  const { streaming, stop } = useComposer();
  const shown = streaming || !!forceMount;
  const presence = usePresence<HTMLSpanElement>(shown);
  if (!presence.mounted) return null;
  const button =
    variant === 'solid' ? (
      <Button variant="destructive" aria-label="Stop" onClick={stop} className={cx([circleClass, touchTarget], className)} {...props}>
        <span className="block size-[9px] rounded-xs bg-current" />
      </Button>
    ) : (
      <Button variant="ghost" aria-label="Stop" onClick={stop} className={cx([circleClass, touchTarget, 'bg-transparent'], className)} {...props}>
        <StopRing />
        <Icon name="stop-square" size={12} sw={2.4} />
      </Button>
    );
  return (
    // Its column opens from nothing as it pops in, so the neighbours slide aside.
    <span
      ref={presence.ref}
      data-slot="composer-stop-presence"
      className="grid shrink-0 grid-cols-[1fr] overflow-visible transition-[grid-template-columns,opacity,scale] duration-spring-snappy ease-spring-snappy data-starting-style:grid-cols-[0fr] data-starting-style:scale-50 data-starting-style:opacity-0 data-ending-style:grid-cols-[0fr] data-ending-style:scale-50 data-ending-style:opacity-0 motion-reduce:transition-none"
    >
      <span className="flex min-w-0 items-center justify-center">{button}</span>
    </span>
  );
}

export interface ComposerSendProps extends Omit<ButtonProps, 'variant' | 'size'> {
  /** While streaming, become the stop control (default). `false` keeps the send circle (pair it with ComposerStop). */
  morph?: boolean;
  /** The stop control's look when morphing. */
  stopVariant?: ComposerStopProps['variant'];
}

/**
 * The send circle (the kit's `default` Button, round); disabled while there is nothing to send or the Composer is
 * `disabled`. While streaming it morphs into the stop control — the same button: the fill drains (ring) or turns
 * red (solid) and the arrow turns into the stop square. `data-state` says which it is: `send`, `queue` (a
 * ComposerQueue takes the draft) or `stop`.
 */
export function ComposerSend({ morph = true, stopVariant = 'ring', disabled: disabledProp, className, ...props }: ComposerSendProps) {
  const { streaming, canSend, canQueue, send, stop, disabled: composerDisabled } = useComposer();
  // With a ComposerQueue, a draft typed during a reply is sent into the queue: the button stays a send arrow.
  const queueing = streaming && canQueue && canSend;
  const stopping = streaming && morph && !queueing;
  const disabled = disabledProp ?? (stopping ? false : composerDisabled || !canSend || (streaming && !canQueue));
  return (
    <Button
      variant={stopping && stopVariant === 'solid' ? 'destructive' : 'default'}
      data-state={stopping ? 'stop' : queueing ? 'queue' : 'send'}
      aria-label={stopping ? 'Stop' : queueing ? 'Queue message' : 'Send'}
      disabled={disabled}
      onClick={(event) => (stopping ? stop() : send(event.nativeEvent))}
      className={cx(
        [
          circleClass,
          touchTarget,
          'overflow-visible [transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
          stopping && stopVariant === 'ring' && 'bg-transparent text-foreground',
        ],
        className,
      )}
      {...props}
    >
      <Swap effect="pop" value={stopping ? `stop-${stopVariant}` : 'send'} className="size-full">
        {!stopping ? (
          <Icon name="arrow-up-compact" size={16} sw={2.4} />
        ) : stopVariant === 'solid' ? (
          <span className="block size-[9px] rounded-xs bg-current" />
        ) : (
          <>
            <StopRing />
            <Icon name="stop-square" size={12} sw={2.4} />
          </>
        )}
      </Swap>
    </Button>
  );
}

export interface ComposerAddProps extends Omit<React.ComponentProps<typeof FileInputTrigger>, 'children' | 'controller'> {
  /** Files the picker offers (MIME types, wildcards, extensions). Defaults to the Composer's `acceptedFileTypes`. */
  acceptedFileTypes?: string[];
  /** Pick several files at once (default `true`). */
  multiple?: boolean;
  /** Pick a whole folder instead of files. */
  directory?: boolean;
  /** On mobile, open the camera (`user` / `environment`, or `true` for the default one) rather than the library. */
  capture?: 'user' | 'environment' | boolean;
  /** The glyph: an `Icon` name or a node (default `plus`; `paperclip-diagonal` for an attach button). */
  icon?: IconName | (string & {}) | React.ReactNode;
  /** Accessible name and tooltip (default "Add files"; "Attach files" beside a paperclip). */
  label?: string;
}

/**
 * The "+" (or paperclip) button: UI SDK's FileInputTrigger in the kit's quiet icon-button look. It opens the file
 * picker and attaches what you pick — images as chips at the caret, other files as tiles. Pair it with
 * `ComposerAttachments`.
 */
export function ComposerAdd({
  acceptedFileTypes,
  multiple = true,
  directory,
  capture,
  icon = 'plus',
  label = 'Add files',
  disabled,
  className,
  ...props
}: ComposerAddProps) {
  const { attachFiles, acceptedFileTypes: accepted, disabled: composerDisabled } = useComposer();
  // Files the picker's filter let through but its `accept` doesn't match go to `attachFiles` too: it turns them
  // away with the composer's toast.
  const rejected = (files: FileRejection[]) => attachFiles(files.map((r) => r.file as File), { source: 'picker' });
  return (
    <FileInput
      className="contents"
      accept={acceptedFileTypes ?? accepted}
      multiple={multiple}
      directory={directory}
      capture={capture}
      disabled={disabled ?? composerDisabled}
      value={NO_FILES}
      onValueChange={(_, details) => takeFiles(attachFiles, details.added, details)}
      onReject={rejected}
      announcement={silent}
    >
      <FileInputTrigger aria-label={label} title={label} className={cx(iconButtonClass, className)} {...props}>
        {typeof icon === 'string' ? <Icon name={icon} size={icon === 'plus' ? 17 : 15.5} sw={2} /> : icon}
      </FileInputTrigger>
    </FileInput>
  );
}

export interface ComposerExpandProps extends Omit<React.ComponentProps<typeof ToggleButton>, 'pressed' | 'defaultPressed' | 'onPressedChange' | 'children'> {
  ref?: React.Ref<HTMLButtonElement>;
}

/** Toggles the tall drafting mode (UI SDK's Toggle: `aria-pressed`). Sits in the card's top-right corner unless restyled. */
export function ComposerExpand({ className, ...props }: ComposerExpandProps) {
  const { expanded, setExpanded } = useComposer();
  const label = expanded ? 'Collapse composer' : 'Expand composer';
  return (
    <ToggleButton
      data-composer-expand=""
      aria-label={label}
      title={label}
      {...props}
      pressed={expanded}
      onPressedChange={(pressed, details) => setExpanded(pressed, details)}
      className={cx(
        [
          iconButtonClass,
          'absolute top-[7px] right-2 z-2',
          // Compact: fades out of the way rather than vanishing.
          'group-data-[collapsed=compact]/composer:pointer-events-none group-data-[collapsed=compact]/composer:scale-75 group-data-[collapsed=compact]/composer:opacity-0 [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
        ],
        className,
      )}
    >
      <Swap effect="pop" value={expanded ? 'restore' : 'expand'} className="size-full">
        <Icon name={expanded ? 'arrows-collapse' : 'arrows-expand'} size={14} sw={2} />
      </Swap>
    </ToggleButton>
  );
}

/* ── Attachments strip ── */
/** A thumbnail's dark well: the `terminal` theme scope (dark in either appearance). */
const TERMINAL_WELL = themeScopeProps({ scope: 'terminal', appearance: 'dark' });
/** Each kind's glyph and colour on its tile (video, audio and archive are iOS system hues: the `kind-*` tokens). */
const KIND_FACE: Record<ComposerAttachmentKind, { icon: string; tone: string; label: string }> = {
  image: { icon: 'photo', tone: 'bg-success/15 text-success', label: 'Image' },
  video: { icon: 'video', tone: 'bg-kind-video/15 text-kind-video', label: 'Video' },
  audio: { icon: 'music-note', tone: 'bg-kind-audio/15 text-kind-audio', label: 'Audio' },
  pdf: { icon: 'doc', tone: 'bg-destructive/15 text-destructive', label: 'PDF' },
  text: { icon: 'doc', tone: 'bg-primary/15 text-primary', label: 'Text' },
  archive: { icon: 'archivebox', tone: 'bg-kind-archive/15 text-kind-archive', label: 'Archive' },
  other: { icon: 'doc', tone: 'bg-muted-foreground/15 text-muted-foreground', label: 'File' },
};

/** "PDF · 1.2 MB" — the extension (or the kind) and the size. */
function attachmentMeta(a: ComposerAttachment, kind: ComposerAttachmentKind) {
  const ext = fileExtension(a.name).toUpperCase();
  return [ext && ext.length <= 5 ? ext : KIND_FACE[kind].label, formatFileSize(a.size)].filter(Boolean).join(' · ');
}

/** The small dark badge in a thumbnail's corner (the annotate pencil, a file's extension). */
function TileBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute bottom-1 left-1 grid h-[18px] min-w-[18px] place-items-center rounded-md bg-black/55 px-1 text-caption2 leading-none font-bold tracking-[.02em] text-white uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The face of a non-image file: a video's poster, a text file's first lines, else a glyph with its name and size. */
function FileTileFace({ a, kind }: { a: ComposerAttachment; kind: ComposerAttachmentKind }) {
  const ext = fileExtension(a.name);
  if (kind === 'video' && a.preview) {
    return (
      <span className="relative block h-[58px] w-[104px]">
        <img
          src={a.preview}
          alt=""
          className="block size-full object-cover transition-[opacity,filter] duration-spring-smooth ease-spring-smooth starting:opacity-0 starting:blur-[6px] motion-reduce:transition-none"
        />
        <span className="absolute top-1/2 left-1/2 grid size-[22px] -translate-1/2 place-items-center rounded-full bg-black/55 pl-px text-white">
          <Icon name="play" size={11} sw={2} className="[&_path]:fill-current" />
        </span>
        {ext ? <TileBadge>{ext}</TileBadge> : null}
      </span>
    );
  }
  if (kind === 'text' && a.excerpt) {
    return (
      <span className="relative block h-[58px] w-[112px] text-left">
        <span className="block h-full overflow-hidden px-[7px] pt-[6px] font-mono text-[6px] leading-[8px] whitespace-pre text-muted-foreground [mask-image:linear-gradient(to_bottom,#000_45%,transparent_92%)]">
          {a.excerpt}
        </span>
        {ext ? <TileBadge>{ext}</TileBadge> : null}
      </span>
    );
  }
  const face = KIND_FACE[kind];
  return (
    <span className="flex h-[58px] w-[164px] min-w-0 items-center gap-2.5 px-2.5 text-left">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', face.tone)}>
        <Icon name={face.icon} size={20} sw={1.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-caption leading-[16px] font-medium text-foreground">{a.name}</span>
        <span className="truncate text-caption2 leading-[14px] text-muted-foreground">{attachmentMeta(a, kind)}</span>
      </span>
    </span>
  );
}

/** One tile of the strip: it pops in, and pops out of the row (its neighbours slide over its place) as it leaves. */
function AttachmentTile({ entry, recovery, children }: { entry: PresenceEntry<ComposerAttachment>; recovery: FocusRecovery; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const a = entry.item;
  // A tile that leaves with focus in it (✕, Backspace, Delete) hands focus on: UI SDK's focus recovery.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !entry.present) return;
    return recovery.bind(el, { key: entry.key, props: undefined });
  }, [entry.present, entry.key, recovery]);
  // Leaving, the tile is lifted out of the row where it stood, so the others close the gap while it fades.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || entry.present) return;
    el.style.position = 'absolute';
    el.style.left = `${el.offsetLeft}px`;
    el.style.top = `${el.offsetTop}px`;
    return () => {
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
    };
  }, [entry.present]);
  useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited });
  return (
    <div
      ref={ref}
      data-slot="composer-attachment"
      data-attachment-id={a.id}
      data-kind={resolveKind(a)}
      className="relative transition-[opacity,scale,filter] duration-spring-snappy ease-spring-snappy data-starting-style:scale-60 data-starting-style:opacity-0 data-starting-style:blur-[4px] data-ending-style:scale-60 data-ending-style:opacity-0 data-ending-style:blur-[4px] motion-reduce:transition-none"
    >
      {children}
    </div>
  );
}

/**
 * The attachments as tiles: images as thumbnails (click to annotate), videos as their first frame, text and
 * code as their first lines, other files as a glyph with name and size (click to open). ✕ — or Backspace /
 * Delete on a focused tile — removes one (an image's chip goes too). A block-start addon. The strip opens and
 * closes as a height morph, and tiles pop in and out while their neighbours slide.
 */
export function ComposerAttachments({ className, ...props }: Omit<ComposerAddonProps, 'align'>) {
  const { attachments, annotate, canAnnotate, removeAttachment, editor, disabled } = useComposer();
  const strip = useRef<HTMLDivElement | null>(null);
  const presence = usePresence<HTMLDivElement>(attachments.length > 0);
  const tiles = usePresenceList(attachments, (a) => a.id);

  // The tiles that stay slide to their new places (read before the change commits, played after).
  const order = attachments.map((a) => a.id).join();
  const committed = useRef(order);
  const before = useRef<FlipSnapshot | null>(null);
  if (order !== committed.current && !before.current && strip.current) {
    before.current = flipSnapshot(strip.current.querySelectorAll(':scope > [data-slot="composer-attachment"]'));
  }
  React.useLayoutEffect(() => {
    committed.current = order;
    const snap = before.current;
    before.current = null;
    if (snap) flipPlay(snap, { spring: 'snappy' });
  }, [order]);

  // Focus leaving with a tile goes to the next tile still in the strip, else the one before, else the editor:
  // never to the page.
  const latestEditor = useRef(editor);
  latestEditor.current = editor;
  const recovery = React.useMemo(
    () =>
      createFocusRecovery({
        fallback: (lost) => {
          const open = Array.from(strip.current?.querySelectorAll<HTMLElement>('[data-slot="composer-attachment"]:not([data-ending-style]) [data-attachment-open]') ?? []);
          const after = open.find((t) => lost.el.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
          const target = after ?? open[open.length - 1];
          if (target) return target;
          latestEditor.current?.commands.focus('end');
          return null;
        },
      }),
    [],
  );
  const onTileKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    e.preventDefault();
    removeAttachment(id, { reason: 'remove', event: e.nativeEvent });
  };
  if (!presence.mounted) return null;
  return (
    <div
      ref={presence.ref}
      data-slot="composer-attachments-presence"
      className="order-[-2] grid w-full min-w-0 grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-spring-smooth ease-spring-smooth data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0 data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 group-data-[collapsed=compact]/composer:hidden motion-reduce:transition-none"
    >
      <div className="min-h-0 overflow-hidden">
        <ComposerAddon
          ref={strip}
          data-slot="composer-attachments"
          align="block-start"
          // The tiles stay clear of a ComposerExpand in the card's corner.
          className={cn('relative flex-wrap gap-2 group-has-[[data-composer-expand]]/composer-card:pr-10', className)}
          {...props}
        >
          {tiles.map((entry) => {
            const a = entry.item;
            const kind = resolveKind(a);
            const meta = attachmentMeta(a, kind);
            return (
              <AttachmentTile key={entry.key} entry={entry} recovery={recovery}>
                {kind === 'image' ? (
                  <>
                    <SdkButton
                      data-attachment-open=""
                      onClick={() => annotate(a.id)}
                      onKeyDown={onTileKey(a.id)}
                      title={`${canAnnotate ? 'Annotate' : 'Preview'} ${a.name}`}
                      aria-label={`${canAnnotate ? 'Annotate' : 'Preview'} ${a.name}`}
                      // The thumbnail sits in a dark well in either appearance: a `terminal` theme scope.
                      data-theme-scope={TERMINAL_WELL['data-theme-scope']}
                      className={cn(TERMINAL_WELL.className, pressableFocusRing, 'block cursor-pointer overflow-hidden rounded-ctl border border-border bg-background p-0')}
                    >
                      {a.src ? (
                        <img src={a.src} alt={a.name} className="block h-[58px] max-w-[130px] object-cover" />
                      ) : (
                        <span className="grid h-[58px] w-[72px] place-items-center text-tertiary-foreground">
                          <Icon name="doc-corner" size={18} sw={1.7} />
                        </span>
                      )}
                    </SdkButton>
                    {canAnnotate ? (
                      <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1 grid size-[18px] place-items-center rounded-md bg-black/55 text-white">
                        <Icon name="pencil" size={11} sw={2.2} />
                      </span>
                    ) : null}
                  </>
                ) : (
                  <SdkButton
                    data-attachment-open=""
                    onClick={() => {
                      if (a.src && typeof window !== 'undefined') window.open(a.src, '_blank', 'noopener');
                    }}
                    onKeyDown={onTileKey(a.id)}
                    title={`${a.name}${meta ? ` · ${meta}` : ''}`}
                    aria-label={`Open ${a.name}${meta ? `, ${meta}` : ''}`}
                    className={cn(pressableFocusRing, 'block cursor-pointer overflow-hidden rounded-ctl border border-border bg-secondary p-0 font-sans')}
                  >
                    <FileTileFace a={a} kind={kind} />
                  </SdkButton>
                )}
                <SdkButton
                  onClick={(event) => removeAttachment(a.id, { reason: 'remove', event: event.nativeEvent })}
                  disabled={disabled}
                  aria-label={`Remove ${a.name}`}
                  // The button is a 24px target (44px on touch screens); the 18px badge is drawn inside it.
                  className={cn(
                    pressableFocusRing,
                    touchTarget,
                    'absolute -top-[9px] -right-[9px] grid size-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground data-disabled:hidden',
                  )}
                >
                  <span aria-hidden="true" className="grid size-[18px] place-items-center rounded-full border border-border bg-popover">
                    <Icon name="xmark" size={9} sw={2.6} />
                  </span>
                </SdkButton>
              </AttachmentTile>
            );
          })}
        </ComposerAddon>
      </div>
    </div>
  );
}

/* ── Input ── */
function caretOnPlainLine(editor: ComposerEditor): boolean {
  const { $from, empty } = editor.state.selection;
  return empty && $from.depth === 1 && $from.parent.type.name === 'paragraph';
}

export interface ComposerInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onKeyDown' | 'onPaste' | 'aria-label'> {
  placeholder?: string;
  /** The field's accessible name (default "Message"). The editor is a contenteditable, so it has no name of its own. */
  'aria-label'?: string;
  /** Focus the editor when it mounts. */
  autoFocus?: boolean;
  /** How pasted/dropped images enter: attachment chips (default) or inline image blocks. */
  imagePaste?: 'chip' | 'inline';
  /** The "/" command menu (default true). */
  slashMenu?: boolean;
  /** What "@" and "#" offer (files, people, issues): the Docstream editor's reference sources. */
  references?: GitbookEditorProps['references'];
  /** The wrapper element around the editor. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The Docstream WYSIWYG editor. Enter sends from a plain paragraph (lists, quotes, code keep their own Enter),
 * ⌘/Ctrl+Enter always sends, Shift+Enter breaks the line; pasted Markdown becomes structure; pasted or dropped
 * images become attachment chips (hover previews, click annotates).
 */
export function ComposerInput({
  placeholder = 'Ask anything — @ files, / commands, paste images',
  'aria-label': ariaLabel = 'Message',
  autoFocus,
  imagePaste = 'chip',
  slashMenu = true,
  references,
  className,
  ref,
  ...props
}: ComposerInputProps) {
  const ctx = useComposerInternals();
  const { value, setValue, expanded, attachments, addAttachment, setEditor, collapsed, disabled } = ctx;
  const latest = useRef(ctx);
  latest.current = ctx;
  const editorRef = useRef<ComposerEditor | null>(null);

  const handleKeyDown = (event: KeyboardEvent) => {
    const editor = editorRef.current;
    if (!editor || event.key !== 'Enter') return false;
    if (event.metaKey || event.ctrlKey) {
      latest.current.send(event);
      return true;
    }
    if (event.shiftKey) return editor.commands.insertContent({ type: 'hardBreak' });
    // An open "/ @ #" menu takes Enter before the editor sees it, so this only runs with no menu open.
    if (!caretOnPlainLine(editor)) return false;
    latest.current.send(event);
    return true;
  };
  // Pasted files attach (images as chips, others as tiles); Markdown-looking text becomes structure.
  const handlePaste = (event: ClipboardEvent) => {
    const data = event.clipboardData;
    const files = Array.from(data?.files ?? []);
    if (files.length) {
      // The editor decides about its own pastes: the card's drop zone, around it, takes pastes from elsewhere.
      event.stopPropagation();
      const images = files.every((f) => f.type.startsWith('image/'));
      // A Word / Excel selection ships a rendered PNG beside its text: that is a text paste. Inline image
      // blocks are the editor's own.
      if (images && (imagePaste === 'inline' || data?.getData('text/plain').trim())) return false;
      event.preventDefault();
      latest.current.attachFiles(files, { source: 'paste', event });
      return true;
    }
    const text = data?.getData('text/plain') ?? '';
    if (!looksLikeMarkdown(text) || !editorRef.current) return false;
    return insertMarkdown(editorRef.current, text);
  };
  // The name goes on the contenteditable itself (a role="textbox" div has none otherwise).
  const labelRef = useRef(ariaLabel);
  labelRef.current = ariaLabel;
  const nameEditor = React.useCallback((editor: ComposerEditor | null) => {
    try {
      if (editor && !editor.isDestroyed) editor.view.dom.setAttribute('aria-label', labelRef.current);
    } catch {
      /* the view isn't mounted yet: the effect below names it once it is */
    }
  }, []);
  React.useEffect(() => nameEditor(editorRef.current), [ariaLabel, nameEditor, ctx.editor]);
  const onEditorReady = React.useCallback(
    (editor: ComposerEditor | null) => {
      editorRef.current = editor;
      setEditor(editor);
      nameEditor(editor);
    },
    [setEditor, nameEditor],
  );
  const onAttachmentOpen = React.useCallback((a: ComposerAttachment) => {
    latest.current.annotate(a.id);
  }, []);

  return (
    <div ref={ref} data-slot="composer-input" data-disabled={disabled || undefined} className={cn('order-0 min-w-0 flex-1 basis-[60%] data-disabled:opacity-60', className)} {...props}>
      <GitbookEditor
        markdown={value}
        editable={!disabled}
        onChange={(markdown) => setValue(markdown, { reason: 'input-change' })}
        toolbar={false}
        slashMenu={slashMenu}
        references={references}
        placeholder={placeholder}
        autofocus={autoFocus}
        className={cn('wb-composer-doc', expanded && collapsed === 'none' && 'wb-composer-doc-expanded', collapsed === 'compact' && 'wb-composer-doc-compact')}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        imagePaste={imagePaste}
        attachments={attachments}
        // Images the editor takes itself (a drop onto a card without a drop zone).
        onAttachmentAdd={({ file, ...attachment }) => {
          addAttachment({ ...attachment, kind: 'image', file }, { reason: 'drop' });
        }}
        // Chips deleted, cut or cleared in the editor drop their attachment.
        onAttachmentRemove={(ids) => ids.forEach((id) => latest.current.removeAttachment(id))}
        onAttachmentOpen={onAttachmentOpen}
        onEditorReady={onEditorReady}
      />
    </div>
  );
}

/* ── Bumps ── */
export const composerBumpVariants = cva('relative box-border flex min-w-0 flex-col text-caption text-muted-foreground', {
  variants: {
    side: {
      top: 'order-[-1]',
      bottom: 'order-1',
    },
    variant: {
      /** Attached to the card: inset, same border, tucked behind the card's edge. */
      attached: 'border border-border bg-popover',
      /** A separate rounded strip with a gap (the Workbench checkout bar). */
      detached: 'rounded-lg bg-secondary',
      /** No chrome — just a row (suggestions, hints). */
      flush: '',
    },
  },
  compoundVariants: [
    // The top bump slides 12px under the card; its content sits above the tuck.
    // No z-index of their own (not a stacking context), so a control flying in can cross over the card.
    { side: 'top', variant: 'attached', className: 'mx-(--bump-inset) -mb-3 rounded-t-card border-b-0 pb-3' },
    { side: 'bottom', variant: 'attached', className: 'mx-(--bump-inset) -mt-3 rounded-b-card border-t-0 pt-3' },
    { side: 'top', variant: 'detached', className: 'mx-2 mb-1.5' },
    { side: 'bottom', variant: 'detached', className: 'mx-2 mt-1.5' },
    { side: 'top', variant: 'flush', className: 'mb-1.5' },
    { side: 'bottom', variant: 'flush', className: 'mt-1.5' },
  ],
  defaultVariants: { side: 'bottom', variant: 'attached' },
});

/** Why a draggable bump opened or closed: its handle pressed, dragged, Escape, or code. */
export type ComposerBumpOpenChangeReason = 'press' | 'drag' | 'escape-key' | 'imperative';
export type ComposerBumpOpenChangeDetails = ChangeDetails<ComposerBumpOpenChangeReason>;
/** Why a minimizable bump folded into (or out of) its FAB: a drag below rest, or its handle pressed. */
export type ComposerBumpMinimizedChangeReason = 'press' | 'drag';
export type ComposerBumpMinimizedChangeDetails = ChangeDetails<ComposerBumpMinimizedChangeReason>;

export interface ComposerBumpContextValue {
  side: 'top' | 'bottom';
  draggable: boolean;
  open: boolean;
  setOpen: (open: boolean, given?: ChangeGiven<ComposerBumpOpenChangeReason>) => boolean;
  /** Current revealed body height (px). */
  reveal: number;
  /** 0 at rest (peek), 1 fully open. */
  progress: number;
  peek: number;
  maxReveal: number;
  dragging: boolean;
  /** The body is transitioning to rest (after a release, a tap or Escape). */
  settling: boolean;
  /** The id of the ComposerBumpContent (the grip's `aria-controls`). */
  contentId: string;
}
/** What the bump's own parts read beside the public value. */
interface ComposerBumpInternals extends ComposerBumpContextValue {
  /** Starts a drag from a press on the handle. */
  startDrag: ((event: React.PointerEvent<HTMLElement>) => void) | null;
  toggle: (event?: Event) => void;
  windowRef: React.RefObject<HTMLDivElement | null>;
}
const ComposerBumpContext = React.createContext<ComposerBumpInternals | null>(null);

function useBumpInternals(): ComposerBumpInternals {
  const ctx = React.useContext(ComposerBumpContext);
  if (!ctx) throw new Error('useComposerBump must be used within <ComposerBump>');
  return ctx;
}

/** The nearest ComposerBump's state: open, how far it is revealed, dragging. */
export function useComposerBump(): ComposerBumpContextValue {
  return useBumpInternals();
}

export interface ComposerBumpProgress {
  /** 0 at rest, 1 fully open. */
  progress: number;
  /** Revealed body height (px): the finger's while dragging, else where the body is heading. */
  reveal: number;
  /** 0–1 fold towards a FAB while dragging below rest (minimizable bumps). */
  minimize: number;
  dragging: boolean;
  /** The bump's own CSS transition is carrying it to rest: a host driving CSS from `progress` transitions too. */
  settling: boolean;
}

/** Extra downward travel (past the peek) that folds the surface into its FAB. */
const BUMP_MINIMIZE_TRAVEL = 96;
/** Share of the fold travel a release must reach (projected) to fold into the FAB. */
const BUMP_FOLD_COMMIT = 0.5;
/** How far (ms of travel at release speed) a flick is carried before picking the nearest rest. */
const BUMP_PROJECT_MS = 200;
/** Release speed (px/ms) above which a drag counts as a flick toward the next rest. */
const BUMP_FLICK_SPEED = 0.4;
interface BumpDragOptions {
  open: boolean;
  onOpenChange: (open: boolean, given: ChangeGiven<ComposerBumpOpenChangeReason>) => boolean;
  peek: number;
  maxReveal: number;
  minimizable: boolean;
  minimized: boolean;
  onMinimizedChange?: (minimized: boolean, details: ComposerBumpMinimizedChangeDetails) => void;
  windowRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * A draggable bump's gesture, on UI SDK's `bindDrag` and gesture math: the body follows the pointer one-to-one
 * (rubber-banding past its ends), and a release projects the pointer's velocity forward to pick a rest (peek,
 * open, or the FAB). The body then transitions there in CSS on the `tray` spring; grabbing it mid-way catches it
 * where it is.
 */
function useBumpDrag({ open, onOpenChange, peek, maxReveal, minimizable, minimized, onMinimizedChange, windowRef }: BumpDragOptions) {
  const target = open ? maxReveal : peek;
  const [drag, setDrag] = useState<{ reveal: number; minimize: number } | null>(null);
  // `settling` holds from a release (or a new rest) until the body's own CSS transition has finished: UI SDK's
  // `animateIn` reports when the element's running animations end (at once without any, as under reduced motion).
  const [settle, setSettle] = useState(0);
  const settling = settle > 0;
  const cleanup = useRef<(() => void) | null>(null);
  const startSettle = React.useCallback(() => setSettle((n) => n + 1), []);
  // A tap, Escape or a prop moves the rest: the body transitions there.
  const rest = `${target}|${minimized}`;
  const restRef = useRef(rest);
  React.useEffect(() => {
    if (restRef.current === rest) return;
    restRef.current = rest;
    startSettle();
  }, [rest, startSettle]);
  React.useLayoutEffect(() => {
    const el = windowRef.current;
    if (!settle) return;
    if (!el) return setSettle(0);
    return animateIn(el, () => setSettle(0));
  }, [settle, rest, windowRef]);
  React.useEffect(() => () => cleanup.current?.(), []);

  const travel = Math.max(1, peek + BUMP_MINIMIZE_TRAVEL);
  const minimizeFor = (raw: number) => (minimizable && raw < peek ? Math.min(1, (peek - raw) / travel) : 0);
  const latest = useRef({ open, minimized, peek, maxReveal, onOpenChange, onMinimizedChange, minimizeFor });
  latest.current = { open, minimized, peek, maxReveal, onOpenChange, onMinimizedChange, minimizeFor };

  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // Catch the body where it is, mid-transition included.
    const from = windowRef.current?.getBoundingClientRect().height ?? target;
    const y0 = event.clientY;
    const tracker = createVelocityTracker();
    tracker.add(event.timeStamp, y0);
    let raw = from;
    let moved = false;
    cleanup.current?.();
    cleanup.current = bindDrag(event.currentTarget, event.nativeEvent, {
      threshold: dragThreshold,
      onStart: () => {
        moved = true;
        setSettle(0);
      },
      onMove: ({ y, event: move }) => {
        tracker.add(move.timeStamp, y);
        const { peek: p, maxReveal: max, minimizeFor: fold } = latest.current;
        raw = from + (y0 - y);
        // A FAB-bound bump shrinks through its peek; others rubber-band below it.
        const floor = minimizable ? 0 : Math.min(p, max);
        const shown = raw > max ? max + rubberBand(raw - max, max || 1) * 0.35 : raw < floor ? Math.max(0, floor - rubberBand(floor - raw, max || 1)) : raw;
        setDrag({ reveal: Math.min(max + 24, shown), minimize: fold(raw) });
      },
      onEnd: (end, canceled) => {
        cleanup.current = null;
        if (!moved) return;
        const { open: wasOpen, minimized: wasMinimized, peek: p, maxReveal: max, onOpenChange: setOpen, onMinimizedChange: setMinimized, minimizeFor: fold } = latest.current;
        setDrag(null);
        startSettle();
        if (canceled) return;
        // Up is positive: the reveal grows as the pointer rises.
        const v = -tracker.velocity(end.timeStamp);
        const projected = raw + v * BUMP_PROJECT_MS;
        const fab = minimizable && fold(projected) > BUMP_FOLD_COMMIT && fold(raw) > 0.08;
        const stops = [p, max];
        const clamped = Math.max(0, Math.min(max, projected));
        // A decided flick goes to the next rest the way it was thrown; a gentle release, to the nearest one.
        const ahead = Math.abs(v) > BUMP_FLICK_SPEED ? stops.filter((s) => (v > 0 ? s > raw + 1 : s < raw - 1)) : [];
        const nearest = ahead.length
          ? v > 0
            ? Math.min(...ahead)
            : Math.max(...ahead)
          : stops.reduce((best, s) => (Math.abs(s - clamped) < Math.abs(best - clamped) ? s : best), stops[0]);
        const nextOpen = !fab && nearest === max && max > p;
        if (fab !== wasMinimized) setMinimized?.(fab, changeDetails({ reason: 'drag', event: end }));
        if (nextOpen !== wasOpen) setOpen(nextOpen, { reason: 'drag', event: end });
      },
    });
  };

  const toggle = (event?: Event) => {
    if (minimized) onMinimizedChange?.(false, changeDetails({ reason: 'press', event }));
    onOpenChange(!open, { reason: 'press', event });
  };

  return {
    reveal: drag ? drag.reveal : target,
    minimize: drag ? drag.minimize : minimized ? 1 : 0,
    dragging: !!drag,
    settling,
    startDrag,
    toggle,
  };
}

export interface ComposerBumpProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrag'>, VariantProps<typeof composerBumpVariants> {
  /** Which edge of the card the bump hangs off (default `bottom`). */
  side?: 'top' | 'bottom';
  /** How far an `attached` bump stands in from the card's edges (px, default 12); a draggable one widens to them as it opens. */
  gutter?: number;
  /** A top bump whose `ComposerBumpHandle` drags its `ComposerBumpContent` open, like a sheet. */
  draggable?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  /** Called before a draggable bump opens or closes; `details.cancel()` keeps an uncontrolled bump where it is. */
  onOpenChange?: (open: boolean, details: ComposerBumpOpenChangeDetails) => void;
  /** Body height kept visible while closed. */
  peek?: number;
  /** Body height when open, when there are no `bounds` to fill. */
  maxReveal?: number;
  /** Grow until the bump reaches this element's top edge (minus `boundsInset`). */
  bounds?: React.RefObject<HTMLElement | null>;
  boundsInset?: number;
  /** Dragging below rest folds the host's surface into a FAB (reported through onProgressChange / onMinimizedChange). */
  minimizable?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean, details: ComposerBumpMinimizedChangeDetails) => void;
  /** Fires as the bump moves, so a host can drive a scrim, a width, a FAB. */
  onProgressChange?: (progress: ComposerBumpProgress) => void;
  /** Escape closes an open draggable bump (default). */
  closeOnEscape?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A strip attached above (`side="top"`) or below the card. Bumps order themselves by side, so they can be
 * placed anywhere among the Composer's children. With `draggable`, a top bump is a sheet: its handle pulls
 * the content open one-to-one with the pointer and releases snap open or closed. An open one is a layer in UI
 * SDK's stack, so Escape closes it after any popup opened from inside it.
 */
export function ComposerBump({
  side = 'bottom',
  variant,
  gutter = 12,
  draggable = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  peek: requestedPeek = 0,
  maxReveal: maxRevealProp = 320,
  bounds,
  boundsInset = 0,
  minimizable = false,
  minimized = false,
  onMinimizedChange,
  onProgressChange,
  closeOnEscape = true,
  className,
  style,
  children,
  ref,
  ...props
}: ComposerBumpProps) {
  const [open, setOpen] = useControllableChange<boolean, ComposerBumpOpenChangeReason>(openProp, defaultOpen, onOpenChange);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const bumpRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const contentId = React.useId();

  // With bounds, the open height is the room between the content's (stable) bottom edge and the bounds' top.
  React.useLayoutEffect(() => {
    if (!draggable || !bounds) return;
    const measure = () => {
      const b = bounds.current,
        w = windowRef.current;
      if (!b || !w) return;
      // The grip is pinned above the content (the bump's top padding), so the content stops that much short.
      const host = w.parentElement;
      const grip = host ? parseFloat(getComputedStyle(host).paddingTop) || 0 : 0;
      setMeasured(Math.max(0, Math.round(w.getBoundingClientRect().bottom - b.getBoundingClientRect().top - boundsInset - grip)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (bounds.current) ro.observe(bounds.current);
    const root = windowRef.current?.closest('[data-slot="composer"]');
    if (root) ro.observe(root);
    return () => ro.disconnect();
  }, [draggable, bounds, boundsInset]);

  const maxReveal = bounds ? (measured ?? maxRevealProp) : maxRevealProp;
  const peek = Math.max(0, Math.min(requestedPeek, maxReveal * 0.75));
  const drag = useBumpDrag({ open, onOpenChange: setOpen, peek, maxReveal, minimizable, minimized, onMinimizedChange, windowRef });
  const reveal = draggable ? drag.reveal : 0;
  const progress = maxReveal > peek ? Math.max(0, (reveal - peek) / (maxReveal - peek)) : 0;
  const minimize = drag.minimize;

  const report = useRef(onProgressChange);
  report.current = onProgressChange;
  React.useEffect(() => {
    report.current?.({ progress, reveal, minimize, dragging: drag.dragging, settling: drag.settling });
  }, [progress, reveal, minimize, drag.dragging, drag.settling]);

  // Open, the bump is a layer: Escape goes to the topmost one, so a menu opened from it closes first.
  const closeRef = useRef((event: Event) => setOpen(false, { reason: 'escape-key', event }));
  closeRef.current = (event: Event) => setOpen(false, { reason: 'escape-key', event });
  React.useEffect(() => {
    const el = bumpRef.current;
    if (!draggable || !open || !closeOnEscape || !el) return;
    return bindLayer(el, {
      onDismiss: (reason, event) => {
        if (reason === 'escape-key') closeRef.current(event);
      },
    });
  }, [draggable, open, closeOnEscape]);

  const value: ComposerBumpInternals = {
    side,
    draggable,
    open,
    setOpen,
    reveal,
    progress,
    peek,
    maxReveal,
    dragging: drag.dragging,
    settling: drag.settling,
    startDrag: draggable ? drag.startDrag : null,
    toggle: drag.toggle,
    windowRef,
    contentId,
  };

  return (
    <ComposerBumpContext.Provider value={value}>
      <div
        ref={(el) => {
          bumpRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        data-slot="composer-bump"
        data-side={side}
        data-variant={variant ?? 'attached'}
        data-draggable={draggable || undefined}
        data-open={(draggable && open) || undefined}
        data-dragging={drag.dragging || undefined}
        data-peeking={(draggable && peek > 0 && !open) || undefined}
        className={cn(
          composerBumpVariants({ side, variant }),
          // A draggable bump's grip is pinned to its top edge (absolutely, in this padding) in every state, so
          // the revealed content opens between the grip and the handle's row instead of above the grip.
          draggable && 'has-[>[data-slot=composer-bump-handle]>[data-bump-grip]]:pt-3',
          // It widens to the card's edges as it opens: with the finger, else on the tray spring.
          draggable && !drag.dragging && 'transition-[margin] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
          className,
        )}
        style={
          {
            // An attached bump widens to the card's edges as it opens.
            '--bump-inset': `${gutter * (1 - progress)}px`,
            '--bump-reveal': `${reveal}px`,
            '--bump-max': `${maxReveal}px`,
            '--bump-progress': progress,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </ComposerBumpContext.Provider>
  );
}

export interface ComposerBumpHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show the grip bar above the row (draggable bumps; default true). */
  grip?: boolean;
  /** Accessible name of the open/close control. */
  label?: string;
}

/** Presses on these stay theirs: a drag or a tap on the row doesn't start from them (the grip is the exception). */
const ROW_CONTROL = 'button,a,input,[role=button]';

/** The bump's row. In a draggable bump it is the drag handle: pull up to open, tap the grip to toggle. */
export function ComposerBumpHandle({ grip = true, label, className, children, onPointerDown, onClick, ...props }: ComposerBumpHandleProps) {
  const bump = useBumpInternals();
  if (!bump.draggable)
    return (
      <div data-slot="composer-bump-handle" className={cn('flex min-w-0 items-center gap-[7px] px-[11px] py-1.5', className)} onPointerDown={onPointerDown} onClick={onClick} {...props}>
        {children}
      </div>
    );
  const name = label ?? (bump.open ? 'Collapse' : 'Expand');
  const fromControl = (target: EventTarget) => {
    const control = (target as HTMLElement).closest?.(ROW_CONTROL);
    return !!control && !control.hasAttribute('data-bump-grip');
  };
  return (
    <div
      data-slot="composer-bump-handle"
      data-dragging={bump.dragging || undefined}
      className={cn(
        // Not `relative`: the grip positions against the bump, so it stays at the top edge as the content opens.
        'group/handle flex min-w-0 touch-none flex-col select-none',
        bump.dragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      {...props}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // Controls inside the row (a Stop button) keep their own presses.
        if (!event.defaultPrevented && !fromControl(event.target)) bump.startDrag?.(event);
      }}
      // A tap anywhere on the row (or Enter/Space on the grip) toggles; clicks on controls in the row don't. A drag's
      // own click is swallowed by bindDrag, and pointer capture retargets a tap's click to this row.
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !fromControl(event.target)) bump.toggle(event.nativeEvent);
      }}
    >
      {grip ? (
        // The accessible toggle, and part of the drag surface.
        <SdkButton
          data-bump-grip=""
          aria-label={name}
          aria-expanded={bump.open}
          aria-controls={bump.contentId}
          // 64×12 drawn; on a touch screen it answers presses 44px tall.
          className="absolute top-0 left-1/2 z-1 grid h-3 w-16 -translate-x-1/2 touch-none cursor-[inherit] place-items-center border-0 bg-transparent p-0 outline-none focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-top-2 pointer-coarse:after:h-11 pointer-coarse:after:content-['']"
        >
          <span
            className={cn(
              'block h-1 rounded-full [transition:width_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
              bump.open ? 'w-10 bg-muted-foreground' : 'w-8 bg-handle group-hover/handle:w-10 group-hover/handle:bg-tertiary-foreground',
            )}
          />
        </SdkButton>
      ) : null}
      {children ? (
        <div className={cn('flex min-w-0 items-center gap-[7px] px-[11px] pb-1.5', !grip && 'pt-1.5')}>{children}</div>
      ) : null}
    </div>
  );
}

export interface ComposerBumpContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible name of the revealed region. */
  label?: string;
}

/** The body a draggable bump reveals above its handle. Laid out at its full open height and pinned to the
    handle, so it slides out without reflowing mid-drag. */
export function ComposerBumpContent({ label = 'Details', className, children, ...props }: ComposerBumpContentProps) {
  const bump = useBumpInternals();
  // Still shown while it closes, until the transition is done.
  const expanded = bump.reveal > 0 || bump.settling;
  return (
    <div
      ref={bump.windowRef}
      id={bump.contentId}
      role="region"
      aria-label={label}
      aria-hidden={!expanded}
      inert={!expanded}
      data-slot="composer-bump-content"
      data-peeking={(bump.peek > 0 && !bump.open) || undefined}
      className={cn(
        'relative order-first h-(--bump-reveal) w-full shrink-0 overflow-hidden',
        // The finger sets the height while dragging; otherwise it transitions to rest on the tray spring.
        !bump.dragging && 'transition-[height] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
        expanded ? 'visible' : 'invisible',
        // A peeking body fades its cut top edge.
        'data-peeking:[mask-image:linear-gradient(to_bottom,transparent,#000_34px)]',
        className,
      )}
    >
      <div data-slot="composer-bump-body" className="absolute inset-x-0 bottom-0 flex h-(--bump-max) min-w-0 flex-col justify-end overflow-hidden" {...props}>
        {children}
      </div>
    </div>
  );
}
