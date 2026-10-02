'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitbookEditor, type GitbookEditorProps } from '@brett_lamy/docstream-editor/editor';
import type { EditorAttachment } from '@brett_lamy/docstream-editor';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Dialog,
  FileTrigger,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  VisuallyHidden,
  composeRenderProps,
  useDrop,
  type DropItem,
  type Key,
  type MenuItemProps,
} from 'react-aria-components';
import { useButton } from 'react-aria/useButton';
import { useClipboard } from 'react-aria/useClipboard';
import { useFocusRing } from 'react-aria/useFocusRing';
import { mergeProps } from 'react-aria/mergeProps';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { PlainButton as Button, PlainToggleButton as ToggleButton, type PlainButtonProps as ButtonProps } from '@/components/ui/plain-button';
import { cn, pressable } from '@/lib/utils';
import { Icon, type IconName } from '@/lib/icon';
import { WbPopover } from '@/components/ui/composer/composer-popover';
import { looksLikeMarkdown, insertMarkdown } from '@/components/ui/markdown-editor';
import { useComposerAnnotator, type ComposerAnnotator, type ComposerAnnotatorSurface } from '@/components/ui/composer/annotator';
import { animate, AnimatePresence, motion } from 'framer-motion';
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
import { useSheetDrag, type SheetDragState } from '@/lib/sheet-drag';
import { TextMorph } from '@/components/ui/text-morph';
import { themeScopeProps } from '@/lib/theme';

/* ══ Composer — a compositional prompt box, in the spirit of shadcn's InputGroup ══

   <Composer onSubmit={(markdown, attachments) => …} streaming={busy} onStop={stop}>
     <ComposerBump side="top">…</ComposerBump>            ← bumps lay out by `side`, wherever they are placed
     <ComposerCard>
       <ComposerAttachments />                              ← block-start addon
       <ComposerInput placeholder="Ask anything" />
       <ComposerExpand />
       <ComposerFooter>                                      ← block-end addon
         <ModelPicker … /> <ComposerSeparator /> <ComposerSelect … />
         <ComposerSpacer /> <ComposerAttach /> <ComposerSend />
       </ComposerFooter>
     </ComposerCard>
     <ComposerBump side="bottom">…</ComposerBump>
   </Composer>

   The root owns the draft (markdown + attachments), expanded, streaming and send/stop; every part reads it
   from `useComposer()`. `ComposerOutlet` lets an ancestor add parts to (or wrap the card of) the Composer
   inside it — ArtifactChatContainer uses it to hang its transcript off a draggable top bump. */

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
}

type ComposerEditor = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;

export interface ComposerContextValue {
  /** The draft as GitBook-flavored Markdown (attachment chips serialize as `![name](attachment:id)`). */
  value: string;
  setValue: (markdown: string) => void;
  attachments: ComposerAttachment[];
  addAttachment: (attachment: ComposerAttachment) => void;
  /** Drops an attachment and its chip in the editor. */
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, patch: Partial<ComposerAttachment>) => void;
  /**
   * Adds files as attachments, after the `acceptedFileTypes` / `maxFileSize` / `maxFiles` checks and the
   * `onDropFiles` hook. Images chip into the editor (at `point` when over it, else the caret); other files
   * become tiles with a preview where one is cheap (a video's first frame, a text file's first lines).
   */
  attachFiles: (files: File[], options?: ComposerAttachOptions) => void;
  /** The Composer's `acceptedFileTypes` (the add button and the drop zone use it). */
  acceptedFileTypes?: string[];
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  streaming: boolean;
  /** Whether there is anything to send. */
  canSend: boolean;
  send: () => void;
  stop: () => void;
  /** Hands a message to `onSubmit` directly, bypassing the draft (a ComposerQueue feeding a queued message in). */
  submit: (markdown: string, attachments: ComposerAttachment[]) => void;
  /** A ComposerQueue is mounted: sending while streaming queues the draft instead of being held. */
  canQueue: boolean;
  /** @internal a ComposerQueue registers where queued drafts go. */
  setQueue: (queue: ((markdown: string, attachments: ComposerAttachment[]) => void) | null) => void;
  /** Opens the annotator for an attachment (a plain preview when the annotator is opted out). */
  annotate: (id: string) => void;
  /** An annotator is in effect (PencilKit by default, the `annotator` prop, a ComposerAnnotatorProvider, or `annotateCanvas`). */
  canAnnotate: boolean;
  editor: ComposerEditor | null;
  /** @internal ComposerInput registers its editor here. */
  setEditor: (editor: ComposerEditor | null) => void;
  /** The root element; bumps measure against it. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** @internal set by a ComposerOutlet above the root. */
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  /** How far the composer is collapsed: the full card, a single-row pill, or a FAB. */
  collapsed: ComposerCollapse;
  setCollapsed: (collapsed: ComposerCollapse) => void;
  /** @internal where ComposerOptions move to while compact. */
  optionsOutlet: HTMLElement | null;
  /** @internal */
  setOptionsOutlet: (el: HTMLElement | null) => void;
  /** @internal the FAB the card folds into, when this composer can fold. */
  fab: { icon?: React.ReactNode; restore: () => void } | null;
}

/** `none`: the full card · `compact`: one row, options in the bottom bump · `fab`: a floating button. */
export type ComposerCollapse = 'none' | 'compact' | 'fab';

const ComposerContext = React.createContext<ComposerContextValue | null>(null);

export function useComposer(): ComposerContextValue {
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
  onValueChange?: (markdown: string) => void;
  /** Controlled attachments (pasted, dropped, or picked files). */
  attachments?: ComposerAttachment[];
  defaultAttachments?: ComposerAttachment[];
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void;
  /** Tall drafting mode. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** An agent is replying: send is held and ComposerSend becomes a stop control. */
  streaming?: boolean;
  onStop?: () => void;
  /** Called with the trimmed Markdown (attachment chips as `attachment:` refs) and the attachments. */
  onSubmit?: (markdown: string, attachments: ComposerAttachment[]) => void;
  /**
   * The image annotator the AnnotateLightbox runs when an attachment is pressed. Defaults to the nearest
   * ComposerAnnotatorProvider's, else `PencilKitAnnotator`; `null` opts out (pressing an attachment then opens a
   * plain preview).
   */
  annotator?: ComposerAnnotator | null;
  /** A fixed drawing surface for the AnnotateLightbox instead of an `annotator` (its first <svg> is flattened). */
  annotateCanvas?: React.ReactNode;
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
  onCollapsedChange?: (collapsed: ComposerCollapse) => void;
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
  /** Where the FAB sits in the composer's box. */
  fabPosition?: 'start' | 'center' | 'end';
  /** The FAB's icon (defaults to a compose glyph). */
  fabIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T | ((p: T) => T)) => void] {
  const [inner, setInner] = useState(initial);
  const current = value !== undefined ? value : inner;
  const latest = useRef(current);
  latest.current = current;
  const set = React.useCallback(
    (next: T | ((p: T) => T)) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(latest.current) : next;
      latest.current = v;
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value === undefined, onChange],
  );
  return [current, set];
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
  annotator: annotatorProp,
  annotateCanvas,
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
  fabPosition = 'end',
  fabIcon,
  children,
  className,
  style,
  ref,
}: ComposerProps) {
  const outlet = React.useContext(ComposerOutletContext);
  const contextAnnotator = useComposerAnnotator();
  const annotator = annotatorProp === undefined ? contextAnnotator : annotatorProp;
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const [attachments, setAttachments] = useControllable(attachmentsProp, defaultAttachments, onAttachmentsChange);
  const [expanded, setExpanded] = useControllable(expandedProp, defaultExpanded, onExpandedChange);
  const [collapsed, setCollapsed] = useControllable<ComposerCollapse>(collapsedProp, defaultCollapsed, onCollapsedChange);
  const [editor, setEditor] = useState<ComposerEditor | null>(null);
  const [annotating, setAnnotating] = useState<string | null>(null);
  const [optionsOutlet, setOptionsOutlet] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const attRef = useRef(attachments);
  attRef.current = attachments;

  const canSend = !!(value.trim() || attachments.length);

  const addAttachment = React.useCallback(
    (a: ComposerAttachment) => setAttachments((all) => (all.some((x) => x.id === a.id) ? all : [...all, a])),
    [setAttachments],
  );
  const updateAttachment = React.useCallback(
    (id: string, patch: Partial<ComposerAttachment>) => setAttachments((all) => all.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    [setAttachments],
  );
  const removeAttachment = (id: string) => {
    // Removing the chip reports back through onAttachmentRemove; drop it here too for attachments without a chip.
    editor?.commands.removeAttachment(id);
    setAttachments((all) => all.filter((a) => a.id !== id));
  };

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
  const [announcement, setAnnouncement] = useState('');
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
  const attachFiles = (incoming: File[], { source = 'api', point }: ComposerAttachOptions = {}) => {
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
    setAnnouncement(`Attached ${files.length === 1 ? items[0].name : `${files.length} files`}.`);
    for (const { file, kind, id, name } of items) {
      const base: ComposerAttachment = { id, name, size: file.size, type: file.type, kind, file };
      pendingFiles.current++;
      const settle = (a: ComposerAttachment) => {
        pendingFiles.current--;
        addAttachment(a);
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
  const queueRef = useRef<((markdown: string, attachments: ComposerAttachment[]) => void) | null>(null);
  const [canQueue, setCanQueue] = useState(false);
  const setQueue = React.useCallback((queue: ((markdown: string, attachments: ComposerAttachment[]) => void) | null) => {
    queueRef.current = queue;
    setCanQueue(!!queue);
  }, []);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const submit = React.useCallback((markdown: string, sent: ComposerAttachment[]) => submitRef.current?.(markdown, sent), []);

  const send = () => {
    if (!canSend) return;
    const queue = streaming ? queueRef.current : null;
    if (streaming && !queue) return;
    const markdown = valueRef.current.trim();
    const sent = attRef.current;
    // The receiver owns the sent files' URLs now; they stay valid until this Composer unmounts.
    for (const a of sent) {
      const url = objectUrls.current.get(a.id);
      if (!url) continue;
      sentUrls.current.push(url);
      objectUrls.current.delete(a.id);
    }
    setAttachments([]);
    if (editor) editor.commands.clearContent(true);
    setValue('');
    if (queue) queue(markdown, sent);
    else onSubmit?.(markdown, sent);
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
    // Recent positions, for the speed over the last ~100ms (a flick) — robust to coalesced or jumpy events.
    const samples: { t: number; d: number }[] = [{ t: performance.now(), d: previous }];
    const onScroll = () => {
      const now = performance.now();
      const d = away();
      const delta = d - previous; // > 0: moving away from the anchor
      previous = d;
      while (samples.length > 1 && now - samples[0].t > COLLAPSE_FLICK_WINDOW) samples.shift();
      const base = samples[0];
      const speed = (d - base.d) / Math.max(COLLAPSE_FLICK_WINDOW, now - base.t);
      samples.push({ t: now, d });
      const st = scrollState.current;
      // At (or near) the anchor: the full composer.
      if (d < COLLAPSE_NEAR_ANCHOR) {
        travel = 0;
        if (st.collapsed !== 'none') st.set('none');
        return;
      }
      if (delta < 0) {
        // Heading back: a FAB opens up to the row on the way, so there is something to type into.
        travel = Math.min(0, travel) + delta;
        if (st.collapsed === 'fab' && travel < -160) st.set('compact');
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
      if (canFab && st.collapsed !== 'fab' && (speed > COLLAPSE_FLICK_SPEED || travel > COLLAPSE_FAB_TRAVEL)) st.set('fab');
      else if (st.collapsed === 'none' && travel > 24) st.set('compact');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey]);

  const restore = () => {
    setCollapsed('none');
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
  };

  const ctx: ComposerContextValue = {
    value,
    setValue,
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
    canAnnotate: annotateCanvas !== undefined || !!annotator,
    editor,
    setEditor,
    rootRef,
    renderCard: outlet?.renderCard,
    collapsed,
    setCollapsed,
    optionsOutlet,
    setOptionsOutlet,
    fab: fabEnabled ? { icon: fabIcon, restore } : null,
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
          data-fab-position={fabPosition}
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
          {/* Screen readers hear what a drop, paste or pick attached. */}
          <VisuallyHidden>
            <span data-slot="composer-announcer" role="status" aria-live="polite">
              {announcement}
            </span>
          </VisuallyHidden>
        </div>
        {annotated?.src ? (
          <AnnotateLightbox
            key={annotated.id}
            src={annotated.src}
            canvas={annotateCanvas}
            annotator={annotator}
            origin={origin.current}
            onClose={() => setAnnotating(null)}
            onSave={(src) => {
              updateAttachment(annotated.id, { src, type: 'image/png' });
              setAnnotating(null);
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
  '[data-slot="composer-footer"] > :not([data-slot="composer-spacer"]):not([data-slot="composer-options-home"]), [data-slot="composer-options"] > *, [data-slot="composer-expand"]';

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
export const composerFabVariants = cva([
  pressable,
  'z-3 grid size-[52px] cursor-pointer place-items-center rounded-[50%] border border-border bg-card p-0 text-foreground shadow-[0_10px_30px_-8px_color-mix(in_srgb,black_45%,transparent),0_2px_8px_color-mix(in_srgb,black_14%,transparent)] outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary/60',
]);

export interface ComposerFabProps extends Omit<ButtonProps, 'children'> {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** The folded composer: a round button (a Composer in `fab` mode renders one; FloatingChat reuses it). */
export function ComposerFab({ className, children, 'aria-label': ariaLabel = 'Open composer', ...props }: ComposerFabProps) {
  return (
    <Button data-slot="composer-fab" aria-label={ariaLabel} className={cn(composerFabVariants(), className)} {...props}>
      {children ?? <Icon name="square-pencil" size={21} sw={1.9} />}
    </Button>
  );
}

/* ── Options that move between the footer and the bottom bump ── */
/**
 * The option pills (model, effort, access…). They render in place — the footer — and, while the composer is
 * `compact`, move into the `ComposerOptionsOutlet` (e.g. in the bottom bump). The same elements move (a stable
 * portal host is re-attached), so menus keep their state.
 */
export function ComposerOptions({ children }: { children?: React.ReactNode }) {
  const { collapsed, optionsOutlet } = useComposer();
  const home = useRef<HTMLSpanElement>(null);
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('span');
    el.setAttribute('data-slot', 'composer-options');
    el.style.display = 'contents';
    return el;
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

/** Where ComposerOptions go while the composer is compact (typically in the bottom bump), after a separator. */
export function ComposerOptionsOutlet({ className }: { className?: string }) {
  const { collapsed, setOptionsOutlet } = useComposer();
  const compact = collapsed === 'compact';
  return (
    <>
      {compact ? <ComposerSeparator /> : null}
      <span ref={setOptionsOutlet} data-slot="composer-options-outlet" className={cn(compact ? 'contents' : 'hidden', className)} />
    </>
  );
}

/* ── Card ── */
export const composerCardVariants = cva(
  // Addons order themselves (block-start → inline-start → input → inline-end → block-end), so hosts can place
  // them in any order. z-1 keeps the card over a tucked top bump.
  'relative z-1 box-border flex min-w-0 flex-wrap items-center border border-border bg-card',
  {
    variants: {
      size: {
        /** The Workbench composer: 15px corners and a lifted shadow. */
        default: 'rounded-[15px] shadow-[0_6px_24px_black] shadow-black/8 dark:shadow-black/28',
        /** A rounder, flatter card (T3 Code). */
        lg: 'rounded-[22px] shadow-[0_8px_30px_black] shadow-black/8 dark:shadow-black/22',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export interface ComposerCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof composerCardVariants> {
  /**
   * The card is a react-aria drop zone for files (default): drag files from the OS onto it and they attach; a
   * drop overlay springs in while they hover. Keyboard users reach a hidden drop target after the card's
   * controls, where react-aria's keyboard drag and drop and ⌘V paste work. `false` opts out.
   */
  dropZone?: boolean;
  /** The overlay's title while files hover (default "Drop to attach"). */
  dropLabel?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** Files carried by drop items (directories are read recursively). */
async function filesFromDropItems(items: DropItem[], limit = 500): Promise<File[]> {
  const files: File[] = [];
  const walk = async (list: AsyncIterable<DropItem> | DropItem[]) => {
    for await (const item of list) {
      if (files.length >= limit) return;
      if (item.kind === 'file') files.push(await item.getFile());
      else if (item.kind === 'directory') await walk(item.getEntries());
    }
  };
  await walk(items);
  return files;
}

const carriesFiles = (e: React.DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types ?? []).includes('Files');

/**
 * The card as a react-aria drop target: `useDrop` with a (visually hidden) drop button, as in react-aria's
 * DropZone, but only file drags reach it — text dragged inside the editor keeps the editor's own handling.
 */
function useComposerDrop(card: React.RefObject<HTMLDivElement | null>, disabled: boolean) {
  const { attachFiles } = useComposer();
  const latest = useRef(attachFiles);
  latest.current = attachFiles;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // The drop's files as the browser listed them — for drops whose items can't be read as entries.
  const nativeFiles = useRef<File[]>([]);
  const take = async (items: DropItem[], source: ComposerFileSource, point?: { x: number; y: number }) => {
    const fallback = nativeFiles.current;
    nativeFiles.current = [];
    const read = await filesFromDropItems(items);
    const files = read.length ? read : fallback;
    if (files.length) latest.current(files, { source, point });
  };
  const { dropProps, dropButtonProps, isDropTarget } = useDrop({
    ref: buttonRef,
    hasDropButton: true,
    isDisabled: disabled,
    // Every file is welcome at the door; attachFiles turns away what the composer doesn't take, with a toast.
    getDropOperation: () => 'copy',
    onDrop: (e) => {
      const rect = card.current?.getBoundingClientRect();
      // Keyboard and clipboard drops arrive at 0,0 — they go to the caret.
      const point = rect && (e.x || e.y) ? { x: rect.left + e.x, y: rect.top + e.y } : undefined;
      void take(e.items, 'drop', point);
    },
  });
  const { buttonProps } = useButton({ ...dropButtonProps, isDisabled: disabled || dropButtonProps?.isDisabled }, buttonRef);
  const { clipboardProps } = useClipboard({ isDisabled: disabled, onPaste: (items) => void take(items, 'paste') });
  const { focusProps, isFocusVisible } = useFocusRing();
  // Only file drags: the editor handles its own text drags (moving a selection, dropping a link).
  const gate =
    (handler: React.DragEventHandler | undefined): React.DragEventHandler =>
    (e) => {
      if (carriesFiles(e)) handler?.(e);
    };
  const gated: React.HTMLAttributes<HTMLElement> = {
    onDragEnter: gate(dropProps.onDragEnter),
    onDragOver: gate(dropProps.onDragOver),
    onDragLeave: gate(dropProps.onDragLeave),
    onDrop: gate((e) => {
      nativeFiles.current = Array.from(e.dataTransfer.files ?? []);
      dropProps.onDrop?.(e as React.DragEvent<HTMLElement>);
    }),
  };
  return {
    dropProps: gated,
    buttonProps: mergeProps(buttonProps, clipboardProps, focusProps),
    buttonRef,
    isDropTarget,
    isFocusVisible,
  };
}

/** The card's drop overlay: a tinted wash and ring that spring in, the plus lifting into place. */
function ComposerDropOverlay({ state, label, hint }: { state: 'drop' | 'focus' | null; label?: React.ReactNode; hint: string }) {
  return (
    <AnimatePresence>
      {state ? (
        <motion.div
          key="drop"
          data-slot="composer-drop-overlay"
          data-state={state}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-px z-4 flex items-center justify-center overflow-hidden rounded-[inherit] border-2 border-primary',
            state === 'drop'
              ? 'bg-[color-mix(in_srgb,var(--primary)_11%,var(--card))]'
              : 'border-dashed bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))]',
          )}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={springs.snappy}
        >
          <motion.div
            className="flex min-w-0 items-center gap-2.5 px-4"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={springs.bouncy}
          >
            <motion.span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[0_4px_14px_-4px_var(--primary)] group-data-[collapsed=compact]/composer:size-6"
              initial={{ scale: 0.4, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.4, rotate: -90 }}
              transition={springs.bouncy}
            >
              <Icon name="plus" size={16} sw={2.6} />
            </motion.span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13.5px] font-semibold text-foreground">
                {state === 'focus' ? 'Paste or drop files' : (label ?? 'Drop to attach')}
              </span>
              <span className="truncate text-[11.5px] text-muted-foreground group-data-[collapsed=compact]/composer:hidden">{hint}</span>
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The bordered surface. Holds the input and its addons, takes dropped files; an outlet may wrap it. */
export function ComposerCard({ size, dropZone = true, dropLabel, className, ref, children, ...props }: ComposerCardProps) {
  const { renderCard, collapsed, fab, acceptedFileTypes } = useComposer();
  const folded = collapsed === 'fab' && !!fab;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const drop = useComposerDrop(cardRef, !dropZone || folded);
  const overlay = !dropZone || folded ? null : drop.isDropTarget ? 'drop' : drop.isFocusVisible ? 'focus' : null;
  const card = (
    <div
      ref={(el) => {
        cardRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      data-slot="composer-card"
      data-folded={folded || undefined}
      data-drop-zone={(dropZone && !folded) || undefined}
      data-drop-target={drop.isDropTarget || undefined}
      className={cn(composerCardVariants({ size }), className)}
      {...(dropZone ? mergeProps(props, drop.dropProps) : props)}
    >
      {/* Folded into the FAB, the card keeps its content (faded, inert) and shows the button face over it. */}
      <div data-slot="composer-card-body" className="contents" inert={folded || undefined} aria-hidden={folded || undefined}>
        {children}
      </div>
      {dropZone ? (
        <>
          <ComposerDropOverlay
            state={overlay}
            label={dropLabel}
            hint={acceptedFileTypes?.length ? describeAccepted(acceptedFileTypes) : 'Images, documents, code — any file'}
          />
          <VisuallyHidden>
            <button ref={drop.buttonRef} data-slot="composer-drop-target" aria-label="Attach files: drop or paste here" {...drop.buttonProps} />
          </VisuallyHidden>
        </>
      ) : null}
      {fab ? (
        <Button
          data-slot="composer-fab"
          aria-label="Open composer"
          aria-hidden={!folded || undefined}
          excludeFromTabOrder={!folded}
          onPress={fab.restore}
          className={cn(pressable, 'absolute inset-0 z-3 grid cursor-pointer place-items-center rounded-[inherit] border-0 bg-transparent p-0 text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary/60')}
        >
          {fab.icon ?? <Icon name="square-pencil" size={21} sw={1.9} />}
        </Button>
      ) : null}
    </div>
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

/** A thin vertical rule between footer pills. */
export function ComposerSeparator({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="composer-separator"
      role="separator"
      aria-orientation="vertical"
      className={cn('mx-0.5 h-4 w-px shrink-0 bg-border', className)}
      {...props}
    />
  );
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
export const composerButtonVariants = cva(
  cn(pressable, 'flex shrink-0 cursor-pointer items-center justify-center border-0 font-sans outline-none data-disabled:cursor-default data-disabled:opacity-35 data-focus-visible:ring-2 data-focus-visible:ring-primary/60'),
  {
    variants: {
      variant: {
        /** Transparent until hovered. */
        ghost: 'bg-transparent text-muted-foreground hover:bg-secondary!',
        /** Option pill: label + chevron (model, effort, access). */
        pill: 'gap-[5px] rounded-[7px] bg-transparent px-[7px] py-[5px] text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary!',
        /** Filled accent circle (send). */
        primary: 'rounded-[50%] bg-primary text-white [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
        /** Filled red circle (stop). */
        destructive: 'rounded-[50%] bg-destructive text-white',
      },
      size: {
        icon: 'size-7 rounded-[7px] p-0',
        round: 'size-[30px] rounded-[50%] p-0',
        pill: '',
      },
      tint: { true: 'text-primary', false: '' },
    },
    compoundVariants: [{ variant: 'primary', tint: true, className: 'text-white' }],
    defaultVariants: { variant: 'ghost', size: 'icon', tint: false },
  },
);

export interface ComposerButtonProps extends ButtonProps, VariantProps<typeof composerButtonVariants> {
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/** A react-aria Button in the composer's styles: `ghost` icon button, option `pill`, `primary` / `destructive` circles. */
export function ComposerButton({ variant, size, tint, className, ...props }: ComposerButtonProps) {
  const resolvedSize = size ?? (variant === 'pill' ? 'pill' : variant === 'primary' || variant === 'destructive' ? 'round' : 'icon');
  return (
    <Button
      data-slot="composer-button"
      className={cn(composerButtonVariants({ variant, size: resolvedSize, tint: !!tint }), className)}
      {...props}
    />
  );
}

/** The pill face: optional icon, label, chevron. */
export function ComposerPillLabel({ icon, children }: { icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <>
      {typeof icon === 'string' ? <Icon name={icon} size={13.5} sw={2} /> : icon}
      {/* A changed choice morphs its label by the letters the two share. */}
      {typeof children === 'string' ? <TextMorph className="whitespace-nowrap">{children}</TextMorph> : <span className="whitespace-nowrap">{children}</span>}
      <Icon name="chevron-down-wide" size={11} sw={2.4} className="opacity-60" />
    </>
  );
}

/* ── Select pill ── */
export interface ComposerSelectOption {
  id: string;
  label: string;
  /** Text shown on the pill when selected (defaults to `label`). */
  short?: string;
  description?: string;
}

export interface ComposerSelectProps {
  'aria-label': string;
  options: ComposerSelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Leading icon (an `Icon` name or a node). */
  icon?: IconName | (string & {}) | React.ReactNode;
  tint?: boolean;
  className?: string;
  /** Popover min width. */
  menuClassName?: string;
}

export const composerMenuItemVariants = cva(
  'relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-footnote text-foreground outline-none data-focused:bg-secondary data-pressed:bg-secondary-strong data-disabled:cursor-default data-disabled:opacity-40',
);

export function ComposerMenuItem({ className, children, ...props }: MenuItemProps & { className?: string; children?: React.ReactNode }) {
  return (
    <MenuItem data-slot="composer-menu-item" className={cn(composerMenuItemVariants(), className)} {...props}>
      {composeRenderProps(children, (kids, { isSelected, selectionMode }) => (
        <>
          {selectionMode !== 'none' ? (
            <span className="grid w-3.5 shrink-0 place-items-center text-primary">
              <AnimatePresence initial={false}>
                {isSelected ? (
                  <motion.span
                    key="tick"
                    className="grid place-items-center"
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={springs.bouncy}
                  >
                    <Icon name="checkmark" size={13} sw={2.6} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </span>
          ) : null}
          {kids}
        </>
      ))}
    </MenuItem>
  );
}

/** An option pill that opens a react-aria Menu of choices (effort, access, …). */
export function ComposerSelect({
  'aria-label': ariaLabel,
  options,
  value: valueProp,
  defaultValue,
  onChange,
  icon,
  tint,
  className,
  menuClassName,
}: ComposerSelectProps) {
  const [value, setValue] = useControllable<string>(valueProp, defaultValue ?? options[0]?.id ?? '', onChange);
  const current = options.find((o) => o.id === value) ?? options[0];
  return (
    <MenuTrigger>
      <ComposerButton data-slot="composer-select" variant="pill" tint={tint} aria-label={`${ariaLabel}: ${current?.label ?? ''}`} className={className}>
        <ComposerPillLabel icon={icon}>{current?.short ?? current?.label}</ComposerPillLabel>
      </ComposerButton>
      <WbPopover placement="top start" className={cn('min-w-[190px] p-1', menuClassName)}>
        <Menu
          aria-label={ariaLabel}
          selectionMode="single"
          selectedKeys={value ? [value] : []}
          disallowEmptySelection
          onSelectionChange={(keys) => {
            const k = [...(keys as Set<Key>)][0];
            if (k == null) return;
            setValue(String(k));
          }}
          className="outline-none"
        >
          {options.map((o) => (
            <ComposerMenuItem key={o.id} id={o.id} textValue={o.label}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{o.label}</span>
                {o.description ? <span className="truncate text-[11.5px] text-muted-foreground">{o.description}</span> : null}
              </span>
            </ComposerMenuItem>
          ))}
        </Menu>
      </WbPopover>
    </MenuTrigger>
  );
}

/* ── Send / stop / attach / expand ── */
export interface ComposerStopProps extends Omit<ComposerButtonProps, 'variant'> {
  /** `ring`: a spinning progress ring with a stop square (Workbench); `solid`: a red circle (T3 Code). */
  variant?: 'ring' | 'solid';
  /** Render even when not streaming. */
  forceMount?: boolean;
}

/** The spinning progress ring around the stop square. */
function StopRing() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0 animate-[wbSpin_1s_linear_infinite] motion-reduce:animate-none">
      <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--secondary-strong, var(--accent))" strokeWidth="2.5" />
      <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="24 55" strokeLinecap="round" />
    </svg>
  );
}

/** A glyph that swaps in place: the old one shrinks and blurs out as the new one grows in (a micro-morph). */
function GlyphSwap({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className="relative grid size-full place-items-center"
        initial={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.4, filter: 'blur(3px)' }}
        transition={springs.snappy}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** Stops the reply. Renders only while streaming; pops in and out beside its neighbours. */
export function ComposerStop({ variant = 'ring', forceMount, className, ...props }: ComposerStopProps) {
  const { streaming, stop } = useComposer();
  const shown = streaming || !!forceMount;
  const button =
    variant === 'solid' ? (
      <ComposerButton data-slot="composer-stop" variant="destructive" aria-label="Stop" onPress={stop} className={className} {...props}>
        <span className="block size-[9px] rounded-[2px] bg-current" />
      </ComposerButton>
    ) : (
      <Button
        data-slot="composer-stop"
        className={cn(pressable, 'relative grid size-[30px] cursor-pointer place-items-center border-0 bg-transparent text-foreground', className)}
        onPress={stop}
        aria-label="Stop"
        {...props}
      >
        <StopRing />
        <Icon name="stop-square" size={12} sw={2.4} />
      </Button>
    );
  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.span
          key="stop"
          data-slot="composer-stop-presence"
          className="flex shrink-0 items-center justify-center overflow-visible"
          initial={{ width: 0, opacity: 0, scale: 0.5 }}
          animate={{ width: 'auto', opacity: 1, scale: 1 }}
          exit={{ width: 0, opacity: 0, scale: 0.5 }}
          transition={springs.snappy}
        >
          {button}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

export interface ComposerSendProps extends Omit<ComposerButtonProps, 'variant'> {
  /** While streaming, become the stop control (default). `false` keeps the send circle (pair it with ComposerStop). */
  morph?: boolean;
  /** The stop control's look when morphing. */
  stopVariant?: ComposerStopProps['variant'];
}

/**
 * The send circle; disabled while there is nothing to send. While streaming it morphs into the stop control —
 * the same button: the fill drains (ring) or turns red (solid) and the arrow turns into the stop square.
 */
export function ComposerSend({ morph = true, stopVariant = 'ring', className, ...props }: ComposerSendProps) {
  const { streaming, canSend, canQueue, send, stop } = useComposer();
  // With a ComposerQueue, a draft typed during a reply is sent into the queue: the button stays a send arrow.
  const queueing = streaming && canQueue && canSend;
  const stopping = streaming && morph && !queueing;
  return (
    <Button
      data-slot={stopping ? 'composer-stop' : 'composer-send'}
      data-state={stopping ? 'stop' : queueing ? 'queue' : 'send'}
      aria-label={stopping ? 'Stop' : queueing ? 'Queue message' : 'Send'}
      isDisabled={stopping ? false : !canSend || (streaming && !canQueue)}
      onPress={stopping ? stop : send}
      className={cn(
        pressable,
        'relative flex size-[30px] shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-[50%] border-0 p-0 font-sans text-white outline-none data-disabled:cursor-default data-focus-visible:ring-2 data-focus-visible:ring-primary/60',
        '[transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
        !stopping ? 'bg-primary data-disabled:opacity-35' : stopVariant === 'solid' ? 'bg-destructive' : 'bg-transparent text-foreground',
        className,
      )}
      {...props}
    >
      <GlyphSwap id={stopping ? `stop-${stopVariant}` : 'send'}>
        {!stopping ? (
          <Icon name="arrow-up-compact" size={16} sw={2.4} />
        ) : stopVariant === 'solid' ? (
          <span className="block size-[9px] rounded-[2px] bg-current" />
        ) : (
          <>
            <StopRing />
            <Icon name="stop-square" size={12} sw={2.4} />
          </>
        )}
      </GlyphSwap>
    </Button>
  );
}

export interface ComposerAddProps extends Omit<ComposerButtonProps, 'variant' | 'children'> {
  /** Files the picker offers (MIME types, wildcards, extensions). Defaults to the Composer's `acceptedFileTypes`. */
  acceptedFileTypes?: string[];
  /** Pick several files at once (default `true`). */
  allowsMultiple?: boolean;
  /** Pick a whole directory instead of files. */
  acceptDirectory?: boolean;
  /** On mobile, open the camera (`user` / `environment`) rather than the library. */
  defaultCamera?: 'user' | 'environment';
  /** The glyph (an `Icon` name or a node; default `plus`). */
  icon?: IconName | (string & {}) | React.ReactNode;
  /** Accessible name and tooltip (default "Add files"). */
  label?: string;
}

/**
 * The "+" button: a react-aria `FileTrigger` that opens the file picker and attaches what you pick — images
 * as chips at the caret, other files as tiles. Pair it with `ComposerAttachments`.
 */
export function ComposerAdd({
  acceptedFileTypes,
  allowsMultiple = true,
  acceptDirectory,
  defaultCamera,
  icon = 'plus',
  label = 'Add files',
  className,
  onPress,
  ...props
}: ComposerAddProps) {
  const { attachFiles, acceptedFileTypes: accepted } = useComposer();
  return (
    <FileTrigger
      acceptedFileTypes={acceptedFileTypes ?? accepted}
      allowsMultiple={allowsMultiple}
      acceptDirectory={acceptDirectory}
      defaultCamera={defaultCamera}
      onSelect={(list) => attachFiles(Array.from(list ?? []), { source: 'picker' })}
    >
      <ComposerButton
        data-slot="composer-add"
        variant="ghost"
        aria-label={label}
        title={label}
        onPress={(e) => {
          onPress?.(e);
        }}
        className={className}
        {...props}
      >
        {typeof icon === 'string' ? <Icon name={icon} size={icon === 'plus' ? 17 : 15.5} sw={2} /> : icon}
      </ComposerButton>
    </FileTrigger>
  );
}

export interface ComposerAttachProps extends ComposerAddProps {
  /** @deprecated use `acceptedFileTypes` — an `<input accept>` string (e.g. `"image/*,.pdf"`). */
  accept?: string;
}

/** The paperclip: `ComposerAdd` with a clip glyph (kept for existing compositions). */
export function ComposerAttach({ accept, acceptedFileTypes, label = 'Attach files', ...props }: ComposerAttachProps) {
  return (
    <ComposerAdd
      data-slot="composer-attach"
      icon="paperclip-diagonal"
      label={label}
      acceptedFileTypes={acceptedFileTypes ?? (accept ? accept.split(',').map((t) => t.trim()).filter(Boolean) : undefined)}
      {...props}
    />
  );
}

/** Toggles the tall drafting mode. Sits in the card's top-right corner unless restyled. */
export function ComposerExpand({ className }: { className?: string }) {
  const { expanded, setExpanded } = useComposer();
  const label = expanded ? 'Collapse composer' : 'Expand composer';
  return (
    <ToggleButton
      data-slot="composer-expand"
      className={cn(
        pressable,
        'absolute top-[7px] right-2 z-2 grid size-7 cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent p-0 text-muted-foreground hover:bg-secondary!',
        // Compact: fades out of the way rather than vanishing.
        'group-data-[collapsed=compact]/composer:pointer-events-none group-data-[collapsed=compact]/composer:scale-75 group-data-[collapsed=compact]/composer:opacity-0 [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
        className,
      )}
      aria-label={label}
      isSelected={expanded}
      onPress={() => {
        setExpanded(!expanded);
      }}
      title={label}
    >
      <GlyphSwap id={expanded ? 'restore' : 'expand'}>
        <Icon name={expanded ? 'arrows-collapse' : 'arrows-expand'} size={14} sw={2} />
      </GlyphSwap>
    </ToggleButton>
  );
}

/* ── Attachments strip ── */
/** A thumbnail's dark well: the `terminal` theme scope (dark in either appearance). */
const TERMINAL_WELL = themeScopeProps({ scope: 'terminal', appearance: 'dark' });
/** The annotate lightbox's palette: a dark `workbench` theme scope. */
const LIGHTBOX_SCOPE = themeScopeProps({ scope: 'workbench', appearance: 'dark' });
/** Each kind's glyph and colour on its tile (video, audio and archive are fixed iOS system colours: purple, pink, brown). */
const KIND_FACE: Record<ComposerAttachmentKind, { icon: string; color: string; label: string }> = {
  image: { icon: 'photo', color: 'var(--success, oklch(0.723 0.191 149.6))', label: 'Image' },
  video: { icon: 'video', color: '#AF52DE', label: 'Video' },
  audio: { icon: 'music-note', color: '#FF2D55', label: 'Audio' },
  pdf: { icon: 'doc', color: 'var(--destructive)', label: 'PDF' },
  text: { icon: 'doc', color: 'var(--primary)', label: 'Text' },
  archive: { icon: 'archivebox', color: '#A2845E', label: 'Archive' },
  other: { icon: 'doc', color: 'var(--muted-foreground)', label: 'File' },
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
        'pointer-events-none absolute bottom-1 left-1 grid h-[18px] min-w-[18px] place-items-center rounded-md bg-black/55 px-1 text-[9.5px] leading-none font-bold tracking-[.02em] text-white uppercase',
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
        <motion.img
          src={a.preview}
          alt=""
          className="block size-full object-cover"
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={springs.smooth}
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
      <span
        className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[color-mix(in_srgb,var(--face)_15%,transparent)] text-(--face)"
        // the kind's color comes with the data
        style={{ '--face': face.color } as React.CSSProperties}
      >
        <Icon name={face.icon} size={20} sw={1.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[12.5px] leading-[16px] font-medium text-foreground">{a.name}</span>
        <span className="truncate text-caption2 leading-[14px] text-muted-foreground">{attachmentMeta(a, kind)}</span>
      </span>
    </span>
  );
}

/**
 * The attachments as tiles: images as thumbnails (click to annotate), videos as their first frame, text and
 * code as their first lines, other files as a glyph with name and size (click to open). ✕ — or Backspace /
 * Delete on a focused tile — removes one (an image's chip goes too). A block-start addon. The strip opens and
 * closes as a height morph, and tiles pop in and out while their neighbours slide.
 */
export function ComposerAttachments({ className, ...props }: Omit<ComposerAddonProps, 'align'>) {
  const { attachments, annotate, canAnnotate, removeAttachment, editor } = useComposer();
  const strip = useRef<HTMLDivElement | null>(null);
  // Removing from the keyboard hands focus to a neighbour (or back to the editor), never to the page.
  const removeFromKeyboard = (id: string) => {
    const tiles = Array.from(strip.current?.querySelectorAll<HTMLElement>('[data-slot="composer-attachment-open"]') ?? []);
    const i = tiles.findIndex((t) => t.closest('[data-attachment-id]')?.getAttribute('data-attachment-id') === id);
    const next = tiles[i + 1] ?? tiles[i - 1];
    removeAttachment(id);
    if (next) next.focus();
    else editor?.commands.focus('end');
  };
  const onTileKey = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    e.preventDefault();
    removeFromKeyboard(id);
  };
  return (
    <AnimatePresence initial={false}>
      {attachments.length ? (
        <motion.div
          key="strip"
          data-slot="composer-attachments-presence"
          className="order-[-2] w-full min-w-0 overflow-hidden group-data-[collapsed=compact]/composer:hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springs.smooth}
        >
          <ComposerAddon ref={strip} data-slot="composer-attachments" align="block-start" className={cn('flex-wrap gap-2', className)} {...props}>
            <AnimatePresence mode="popLayout" initial={false}>
              {attachments.map((a) => {
                const kind = resolveKind(a);
                const image = kind === 'image';
                const meta = attachmentMeta(a, kind);
                return (
                  <motion.div
                    key={a.id}
                    layout="position"
                    layoutDependency={attachments.map((x) => x.id).join()}
                    data-slot="composer-attachment"
                    data-attachment-id={a.id}
                    data-kind={kind}
                    className="relative"
                    initial={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
                    transition={springs.snappy}
                  >
                    {image ? (
                      <>
                        <Button
                          data-slot="composer-attachment-open"
                          onPress={() => {
                            annotate(a.id);
                          }}
                          onKeyDown={onTileKey(a.id)}
                          title={`${canAnnotate ? 'Annotate' : 'Preview'} ${a.name}`}
                          aria-label={`${canAnnotate ? 'Annotate' : 'Preview'} ${a.name}`}
                          // The thumbnail sits in a dark well in either appearance: a `terminal` theme scope.
                          data-theme-scope={TERMINAL_WELL['data-theme-scope']}
                          className={cn(TERMINAL_WELL.className, 'block cursor-pointer overflow-hidden rounded-ctl border border-border bg-background p-0')}
                        >
                          {a.src ? (
                            <img src={a.src} alt={a.name} className="block h-[58px] max-w-[130px] object-cover" />
                          ) : (
                            <span className="grid h-[58px] w-[72px] place-items-center text-tertiary-foreground">
                              <Icon name="doc-corner" size={18} sw={1.7} />
                            </span>
                          )}
                        </Button>
                        <span className="pointer-events-none absolute bottom-1 left-1 grid size-[18px] place-items-center rounded-md bg-black/55 text-white">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 4l6 6-10 10H4v-6z" />
                          </svg>
                        </span>
                      </>
                    ) : (
                      <Button
                        data-slot="composer-attachment-open"
                        onPress={() => {
                          if (a.src && typeof window !== 'undefined') window.open(a.src, '_blank', 'noopener');
                        }}
                        onKeyDown={onTileKey(a.id)}
                        title={`${a.name}${meta ? ` · ${meta}` : ''}`}
                        aria-label={`Open ${a.name}${meta ? `, ${meta}` : ''}`}
                        className="block cursor-pointer overflow-hidden rounded-ctl border border-border bg-secondary p-0 font-sans outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary/60"
                      >
                        <FileTileFace a={a} kind={kind} />
                      </Button>
                    )}
                    <Button
                      onPress={() => {
                        removeAttachment(a.id);
                      }}
                      aria-label={`Remove ${a.name}`}
                      // The button is a 24px target; the 18px badge is drawn inside it.
                      className="absolute -top-[9px] -right-[9px] grid size-6 cursor-pointer place-items-center border-0 bg-transparent p-0 text-[10px] leading-none text-muted-foreground"
                    >
                      <span aria-hidden="true" className="grid size-[18px] place-items-center rounded-[50%] border border-border bg-popover">✕</span>
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </ComposerAddon>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ── Input ── */
function caretOnPlainLine(editor: ComposerEditor): boolean {
  const { $from, empty } = editor.state.selection;
  return empty && $from.depth === 1 && $from.parent.type.name === 'paragraph';
}

/** Files dropped on the editor inside a drop-zone card are the card's (they attach — images as chips at the
    drop point); the editor keeps text drags and, without a drop zone, its own image drops. */
const FILE_DROP_EXTENSIONS = [
  Extension.create({
    name: 'composerFileDrop',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              drop: (view, event) =>
                !!event.dataTransfer &&
                Array.from(event.dataTransfer.types ?? []).includes('Files') &&
                !!view.dom.closest('[data-slot="composer-card"][data-drop-zone]'),
            },
          },
        }),
      ];
    },
  }),
];

export interface ComposerInputProps {
  placeholder?: string;
  /** The field's accessible name (default "Message"). The editor is a contenteditable, so it has no name of its own. */
  'aria-label'?: string;
  autoFocus?: boolean;
  /** How pasted/dropped images enter: attachment chips (default) or inline image blocks. */
  imagePaste?: 'chip' | 'inline';
  slashMenu?: boolean;
  references?: GitbookEditorProps['references'];
  className?: string;
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
}: ComposerInputProps) {
  const ctx = useComposer();
  const { value, setValue, expanded, attachments, addAttachment, setEditor, collapsed } = ctx;
  const latest = useRef(ctx);
  latest.current = ctx;
  const editorRef = useRef<ComposerEditor | null>(null);

  const handleKeyDown = (event: KeyboardEvent) => {
    const editor = editorRef.current;
    if (!editor || event.key !== 'Enter') return false;
    if (event.metaKey || event.ctrlKey) {
      latest.current.send();
      return true;
    }
    if (event.shiftKey) return editor.commands.insertContent({ type: 'hardBreak' });
    if (document.querySelector('.slash-menu') || !caretOnPlainLine(editor)) return false;
    latest.current.send();
    return true;
  };
  // Pasted files attach (images as chips, others as tiles); Markdown-looking text becomes structure.
  const handlePaste = (event: ClipboardEvent) => {
    const data = event.clipboardData;
    const files = Array.from(data?.files ?? []);
    if (files.length) {
      const images = files.every((f) => f.type.startsWith('image/'));
      // A Word / Excel selection ships a rendered PNG beside its text: that is a text paste. Inline image
      // blocks are the editor's own.
      if (images && (imagePaste === 'inline' || data?.getData('text/plain').trim())) return false;
      event.preventDefault();
      latest.current.attachFiles(files, { source: 'paste' });
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
    <div data-slot="composer-input" className="order-0 min-w-0 flex-1 basis-[60%]">
      <GitbookEditor
        markdown={value}
        onChange={setValue}
        toolbar={false}
        slashMenu={slashMenu}
        references={references}
        placeholder={placeholder}
        autofocus={autoFocus}
        className={cn('wb-composer-doc', expanded && collapsed === 'none' && 'wb-composer-doc-expanded', collapsed === 'compact' && 'wb-composer-doc-compact', className)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        imagePaste={imagePaste}
        attachments={attachments}
        // Images the editor takes itself (a drop onto a card without a drop zone).
        onAttachmentAdd={({ file, ...attachment }) => {
          addAttachment({ ...attachment, kind: 'image', file });
        }}
        // Chips deleted, cut or cleared in the editor drop their attachment.
        onAttachmentRemove={(ids) => ids.forEach((id) => latest.current.removeAttachment(id))}
        onAttachmentOpen={onAttachmentOpen}
        onEditorReady={onEditorReady}
        extensions={FILE_DROP_EXTENSIONS}
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
      detached: 'rounded-[9px] bg-secondary',
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

export interface ComposerBumpContextValue {
  side: 'top' | 'bottom';
  draggable: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Current revealed body height (px). */
  reveal: number;
  /** 0 at rest (peek), 1 fully open. */
  progress: number;
  peek: number;
  maxReveal: number;
  dragging: boolean;
  /** @internal */
  handleProps: SheetDragState['handlers'] | null;
  /** @internal */
  toggle: () => void;
  /** @internal */
  windowRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
}
const ComposerBumpContext = React.createContext<ComposerBumpContextValue | null>(null);

export function useComposerBump(): ComposerBumpContextValue {
  const ctx = React.useContext(ComposerBumpContext);
  if (!ctx) throw new Error('useComposerBump must be used within <ComposerBump>');
  return ctx;
}

export interface ComposerBumpProgress {
  /** 0 at rest, 1 fully open. */
  progress: number;
  /** Revealed body height (px). */
  reveal: number;
  /** 0–1 fold towards a FAB while dragging below rest (minimizable bumps). */
  minimize: number;
  dragging: boolean;
  /** The spring is carrying the bump to rest (hosts driving CSS from progress should not transition then). */
  settling: boolean;
}

export interface ComposerBumpProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrag'>, VariantProps<typeof composerBumpVariants> {
  side?: 'top' | 'bottom';
  /** Horizontal inset from the card edges for `attached` bumps (px). */
  inset?: number;
  /** A top bump whose `ComposerBumpHandle` drags its `ComposerBumpContent` open, like a sheet. */
  draggable?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  onMinimizedChange?: (minimized: boolean) => void;
  /** Fires as the bump moves, so a host can drive a scrim, a width, a FAB. */
  onProgressChange?: (progress: ComposerBumpProgress) => void;
  /** Escape closes an open draggable bump (default). */
  closeOnEscape?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A strip attached above (`side="top"`) or below the card. Bumps order themselves by side, so they can be
 * placed anywhere among the Composer's children. With `draggable`, a top bump is a sheet: its handle pulls
 * the content open one-to-one with the pointer and releases snap open or closed.
 */
export function ComposerBump({
  side = 'bottom',
  variant,
  inset = 12,
  draggable = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  peek: requestedPeek = 0,
  maxReveal: maxRevealProp = 320,
  bounds,
  boundsInset = 0,
  minimizable = false,
  minimized,
  onMinimizedChange,
  onProgressChange,
  closeOnEscape = true,
  className,
  style,
  children,
  ref,
  ...props
}: ComposerBumpProps) {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const windowRef = useRef<HTMLDivElement | null>(null);
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
  const drag = useSheetDrag({
    open,
    onOpenChange: setOpen,
    peek,
    maxReveal,
    minimizable,
    minimized,
    onMinimizedChange,
  });
  // Follows the finger, then springs to rest carrying the release velocity.
  const reveal = draggable ? drag.reveal : 0;
  const progress = maxReveal > peek ? Math.max(0, (reveal - peek) / (maxReveal - peek)) : 0;
  const minimize = drag.minimize;

  const report = useRef(onProgressChange);
  report.current = onProgressChange;
  React.useEffect(() => {
    report.current?.({ progress, reveal, minimize, dragging: drag.dragging, settling: drag.settling });
  }, [progress, reveal, minimize, drag.dragging, drag.settling]);

  const closeRef = useRef(() => setOpen(false));
  closeRef.current = () => setOpen(false);
  React.useEffect(() => {
    if (!draggable || !open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [draggable, open, closeOnEscape]);

  const value: ComposerBumpContextValue = {
    side,
    draggable,
    open,
    setOpen,
    reveal,
    progress,
    peek,
    maxReveal,
    dragging: drag.dragging,
    handleProps: draggable ? drag.handlers : null,
    toggle: drag.toggle,
    windowRef,
    contentId,
  };

  return (
    <ComposerBumpContext.Provider value={value}>
      <div
        ref={ref}
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
          className,
        )}
        style={
          {
            // An attached bump widens to the card's edges as it opens.
            '--bump-inset': `${inset * (1 - progress)}px`,
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

/** The bump's row. In a draggable bump it is the drag handle: pull up to open, tap the grip to toggle. */
export function ComposerBumpHandle({ grip = true, label, className, children, ...props }: ComposerBumpHandleProps) {
  const bump = useComposerBump();
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Controls inside the row (a Stop button) keep their own presses.
    const target = event.target as HTMLElement;
    const control = target.closest('button,a,input,[role=button]');
    if (control && !control.hasAttribute('data-bump-grip')) return;
    bump.handleProps?.onPointerDown(event);
  };
  if (!bump.draggable)
    return (
      <div data-slot="composer-bump-handle" className={cn('flex min-w-0 items-center gap-[7px] px-[11px] py-1.5', className)} {...props}>
        {children}
      </div>
    );
  const name = label ?? (bump.open ? 'Collapse' : 'Expand');
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
      onPointerDown={onPointerDown}
      // A tap anywhere on the row (or Enter/Space on the grip) toggles; clicks on controls in the row don't.
      // Pointer capture retargets the click to this row, so the toggle lives here rather than on the grip.
      onClick={(event) => {
        const control = (event.target as HTMLElement).closest('button,a,input,[role=button]');
        if (control && !control.hasAttribute('data-bump-grip')) return;
        bump.toggle();
      }}
      onPointerMove={bump.handleProps?.onPointerMove}
      onPointerUp={bump.handleProps?.onPointerUp}
      onPointerCancel={bump.handleProps?.onPointerCancel}
      onLostPointerCapture={bump.handleProps?.onLostPointerCapture}
    >
      {grip ? (
        // A raw button: it is the accessible toggle and part of the drag surface.
        <button
          type="button"
          data-bump-grip=""
          data-slot="composer-bump-grip"
          aria-label={name}
          aria-expanded={bump.open}
          aria-controls={bump.contentId}
          className="absolute top-0 left-1/2 z-1 grid h-3 w-16 -translate-x-1/2 touch-none cursor-[inherit] place-items-center border-0 bg-transparent p-0 outline-none focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span
            className={cn(
              'block h-1 rounded-[999px] [transition:width_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
              bump.open ? 'w-10 bg-muted-foreground' : 'w-8 bg-handle group-hover/handle:w-10 group-hover/handle:bg-tertiary-foreground',
            )}
          />
        </button>
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
  const bump = useComposerBump();
  const expanded = bump.reveal > 0;
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
        // The height is written every frame by the drag and its settling spring, so it never CSS-transitions.
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

/* ══ AnnotateLightbox ══
   Click an attachment (strip thumbnail or inline chip): the annotator's surface overlays the image; Save
   rasterizes image + strokes into one flattened PNG. `canvas` supplies a fixed drawing surface instead. With
   neither (and no provider), it is a preview: the image and a Close button. */
export interface AnnotateLightboxProps {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  /** A fixed drawing surface (its first <svg> is flattened), instead of an annotator. */
  canvas?: React.ReactNode;
  /** The annotator to run; defaults to the nearest ComposerAnnotatorProvider's, else PencilKit. `null` forces the preview. */
  annotator?: ComposerAnnotator | null;
  /** The element the image zooms out of on open and back into on close (a thumbnail); else it scales in. */
  origin?: () => HTMLElement | null;
}

export function AnnotateLightbox({ src, onClose, onSave, canvas, annotator: annotatorProp, origin }: AnnotateLightboxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contextAnnotator = useComposerAnnotator();
  const Annotator = canvas === undefined ? (annotatorProp === undefined ? contextAnnotator : annotatorProp) : null;
  const closing = useRef(false);
  const hidden = useRef<HTMLElement | null>(null);

  // Where the thumbnail is, as the box's transform: scaled to cover it, clipped to its shape and corners.
  const zoomFrom = () => {
    const box = boxRef.current;
    const el = origin?.() ?? null;
    if (!box || !el) return null;
    const s = el.getBoundingClientRect();
    const f = box.getBoundingClientRect();
    if (!s.width || !f.width) return null;
    const scale = Math.max(s.width / f.width, s.height / f.height);
    const vw = s.width / scale,
      vh = s.height / scale;
    const ix = (f.width - vw) / 2,
      iy = (f.height - vh) / 2;
    const radius = parseFloat(getComputedStyle(el.closest('button') ?? el).borderRadius) || 10;
    return {
      el,
      x: s.left + s.width / 2 - (f.left + f.width / 2),
      y: s.top + s.height / 2 - (f.top + f.height / 2),
      scale,
      clip: `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${radius / scale}px)`,
    };
  };

  // Open: the image flies out of the thumbnail it was pressed on; the chrome follows it in.
  React.useLayoutEffect(() => {
    const box = boxRef.current,
      img = imgRef.current;
    if (!box || !img) return;
    const reduce = prefersReducedMotion();
    const fadeIn = (el: HTMLElement | null, delay = 0) =>
      el && animate(el, { opacity: [0, 1], y: [reduce ? 0 : 10, 0] }, reduce ? { duration: 0.15 } : { ...springs.smooth, delay });
    const run = () => {
      animate(backdropRef.current!, { opacity: [0, 1] }, { duration: reduce ? 0.15 : 0.28 });
      fadeIn(chromeRef.current, 0.08);
      fadeIn(toolsRef.current, 0.12);
      const from = reduce ? null : zoomFrom();
      if (!from) {
        animate(box, { opacity: [0, 1], scale: [reduce ? 1 : 0.94, 1] }, reduce ? { duration: 0.15 } : springs.smooth);
        return;
      }
      hidden.current = from.el;
      from.el.style.visibility = 'hidden';
      box.style.opacity = '1';
      animate(
        box,
        { x: [from.x, 0], y: [from.y, 0], scale: [from.scale, 1], clipPath: [from.clip, 'inset(0px 0px 0px 0px round 14px)'] },
        springs.smooth,
      );
    };
    box.style.opacity = '0';
    if (img.complete && img.naturalWidth) run();
    else {
      img.addEventListener('load', run, { once: true });
      img.addEventListener('error', run, { once: true });
    }
    return () => {
      if (hidden.current) hidden.current.style.visibility = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close (cancel, Escape, outside press, save): the image lands back in the thumbnail before unmounting.
  const close = (then: () => void) => {
    if (closing.current) return;
    closing.current = true;
    const box = boxRef.current;
    const reduce = prefersReducedMotion();
    for (const el of [chromeRef.current, toolsRef.current]) if (el) animate(el, { opacity: 0 }, { duration: 0.12 });
    if (backdropRef.current) animate(backdropRef.current, { opacity: 0 }, { duration: reduce ? 0.12 : 0.3 });
    if (hidden.current) hidden.current.style.visibility = '';
    const to = !reduce && box ? zoomFrom() : null;
    if (hidden.current) hidden.current.style.visibility = 'hidden';
    const finish = () => {
      if (hidden.current) hidden.current.style.visibility = '';
      hidden.current = null;
      then();
    };
    if (!box) return finish();
    if (!to) {
      animate(box, { opacity: 0, scale: reduce ? 1 : 0.96 }, { duration: 0.14 }).then(finish);
      return;
    }
    animate(box, { x: to.x, y: to.y, scale: to.scale, clipPath: to.clip }, { ...springs.smooth, restDelta: 0.5, restSpeed: 20 }).then(finish);
  };

  const save = () => {
    const img = imgRef.current,
      box = boxRef.current;
    if (!img || !box) return close(onClose);
    // The box is exactly the image (aspect kept), so strokes map 1:1; export at the image's native resolution.
    const w = img.clientWidth,
      h = img.clientHeight,
      sc = Math.max(1, img.naturalWidth / w);
    const cv = document.createElement('canvas');
    cv.width = w * sc;
    cv.height = h * sc;
    const ctx = cv.getContext('2d');
    if (!ctx) return close(onClose);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const fin = () => {
      const url = cv.toDataURL('image/png');
      close(() => onSave(url));
    };
    const svg = box.querySelector('[data-slot="pencil-canvas"] > svg') ?? box.querySelector('svg');
    if (!svg) return fin();
    const cl = svg.cloneNode(true) as SVGElement;
    cl.setAttribute('width', String(w));
    cl.setAttribute('height', String(h));
    cl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const im = new Image();
    im.onload = () => {
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      fin();
    };
    im.onerror = fin;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  };
  const btn = (label: string, primary: boolean, onPress: () => void) => (
    <Button
      onPress={onPress}
      className={cn(
        'cursor-pointer rounded-[9px] px-3.5 py-[7px] font-sans text-[12.5px] font-[650] text-white',
        primary ? 'border-0 bg-primary' : 'border border-white/20 bg-transparent',
      )}
    >
      {label}
    </Button>
  );
  const preview = canvas === undefined && !Annotator;
  // The lightbox around a surface: chrome above the image, the surface over it, tools under it.
  const layout = (surface: ComposerAnnotatorSurface | null) => (
    <>
      <div ref={chromeRef} className="flex items-center gap-2">
        <span className="flex-1 font-sans text-footnote font-[650] text-foreground">
          {surface ? (surface.title ?? 'Annotate — strokes flatten into the image on save') : 'Preview'}
        </span>
        {surface ? (
          <>
            {btn('Cancel', false, () => close(onClose))}
            {btn('Save annotation', true, save)}
          </>
        ) : (
          btn('Close', true, () => close(onClose))
        )}
      </div>
      <div
        ref={boxRef}
        data-slot="annotate-lightbox-image"
        className="relative origin-center self-center overflow-hidden rounded-card border border-white/14 bg-code will-change-transform"
      >
        <img ref={imgRef} src={src} alt="" className="block h-auto max-h-[68vh] w-auto max-w-[86vw] min-w-[min(340px,86vw)]" />
        {surface?.canvas}
      </div>
      {surface?.toolbar ? <div ref={toolsRef}>{surface.toolbar}</div> : null}
    </>
  );
  return (
    // react-aria modal: portals out of clipping/transformed ancestors, traps focus, Escape or an outside press closes.
    <ModalOverlay
      data-slot="annotate-lightbox"
      data-preview={preview || undefined}
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) close(onClose);
      }}
      className="fixed inset-0 z-400 grid place-items-center"
    >
      <div ref={backdropRef} data-slot="annotate-lightbox-backdrop" aria-hidden="true" className="absolute inset-0 bg-black/74" />
      <Modal className="relative outline-none">
        <Dialog
          aria-label={preview ? 'Preview image' : 'Annotate image'}
          // The lightbox is always a dark Workbench surface (image well, PencilKit tools), whatever opened it.
          {...LIGHTBOX_SCOPE}
          className={cn(LIGHTBOX_SCOPE.className, 'flex max-w-[90vw] flex-col gap-2.5 text-foreground outline-none')}
        >
          {Annotator ? <Annotator>{layout}</Annotator> : layout(canvas === undefined ? null : { canvas })}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
