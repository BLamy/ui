'use client';
import * as React from 'react';
import { GitbookEditor, type GitbookEditorProps } from '@brett_lamy/ui/docstream-editor/editor';
import type { EditorAttachment } from '@brett_lamy/ui/docstream-editor';
import { astToTiptap } from '@brett_lamy/ui/docstream-editor/convert';
import { parseMarkdown } from '@brett_lamy/ui/docstream/gitbook';
import type { ChangeDetails } from '@ui-sdk/core';
import { useFieldControl } from '@ui-sdk/react/field';
import { cva, type VariantProps } from 'class-variance-authority';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Toolbar, ToolbarButton, ToolbarText, ToolbarToggle, type ToolbarButtonProps, type ToolbarToggleProps } from '@/components/ui/toolbar';
import { Icon } from '@/lib/icon';
import { changeDetails } from '@/lib/change-details';
import { cn } from '@/lib/utils';

/* ══ MarkdownEditor — a themed field over the Docstream (TipTap) editor ══

   <MarkdownEditor defaultValue="# Notes" onValueChange={setMarkdown} />

   The value is GitBook-flavored Markdown, the same dialect MarkdownView renders. Type "/" for blocks, paste
   Markdown to get structure, paste or drop images inline or as attachment chips. Colors come from the
   surrounding --bl-* tokens (BLProvider, AppearanceProvider). The editor's popovers (the slash menu, the link
   popover, the chip hover card) render in place in the top layer, so they inherit the same tokens and, inside a
   BLProvider, stay within its layer host.
   Inside a UI SDK Field it is the field's control: the FieldLabel names it, FieldDescription and FieldError
   describe it, and the field's name, disabled and invalid state apply (invalid comes only from the Field). */

/** The TipTap editor instance behind a MarkdownEditor. */
export type MarkdownEditorInstance = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;
export type MarkdownEditorAttachment = EditorAttachment;

/** How live demo blocks (`{% demo %}`) resolve and run: MarkdownView's `MarkdownViewDemo`, the same four fields. */
export interface MarkdownEditorDemo {
  /** Resolves a block's `src` to its component, source files and metadata. */
  resolver?: GitbookEditorProps['demoResolver'];
  /** Runs demos that carry their files inline and have no resolver behind them (`createAlmostNodeDemoRuntime()`). */
  runtime?: GitbookEditorProps['demoRuntime'];
  /** Demo files held in memory by `src` (`createDemoVFS`), e.g. demos pasted into the editor. */
  vfs?: GitbookEditorProps['demoVFS'];
  /** Extra npm dependencies inline demos may import (`{ "@brett_lamy/ui": "^6.0.0" }`). */
  dependencies?: GitbookEditorProps['demoDependencies'];
}

/** Why the Markdown changed: an edit in the editor (typing, paste, a toolbar or "/" command), or a call through
    the ref (`setMarkdown`, `insertMarkdown`, `clear`). */
export type MarkdownEditorValueChangeReason = 'input-change' | 'imperative';
export type MarkdownEditorValueChangeDetails = ChangeDetails<MarkdownEditorValueChangeReason>;

/* Pasted plain text that reads as Markdown is parsed into structure instead of landing as literal text. */
const MARKDOWN_HINTS = [
  /^\s{0,3}#{1,6}\s/m,
  /^\s*(?:[-*+]|\d+[.)])\s/m,
  /^\s*>\s/m,
  /```/,
  /\{%\s*[a-z-]+/,
  /\*\*[^*\n]+\*\*|__[^_\n]+__/,
  /`[^`\n]+`/,
  /\[[^\]\n]+\]\([^)\s]+\)/,
  /^\s*\|.+\|\s*$/m,
  /^\s*(?:---|\*\*\*)\s*$/m,
];

/** Whether pasted plain text looks like Markdown (headings, lists, fences, emphasis, links, tables…). */
export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINTS.some((pattern) => pattern.test(text));
}

/** Inserts Markdown at the selection as structure. Returns false when there is nothing to insert. */
export function insertMarkdown(editor: MarkdownEditorInstance, markdown: string): boolean {
  const doc = astToTiptap(parseMarkdown(markdown));
  if (!doc.content?.length) return false;
  editor.commands.insertContent(doc.content);
  return true;
}

export const markdownEditorVariants = cva(
  [
    'bl-mde group/mde relative box-border flex w-full min-w-0 flex-col text-left [font-family:inherit] text-foreground',
    'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
    'data-disabled:cursor-not-allowed data-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        /** A filled field: Input's and Textarea's box (`fieldSurfaceVariants`), growing with its text. */
        default: '',
        /** No chrome: text on the surface it sits on (inline notes, full-page documents). */
        plain: 'rounded-none bg-transparent',
        /** A raised card with a hairline, for editors that stand on their own; the same rings as a field. */
        card: 'rounded-card bg-card shadow-hairline focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)] data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]',
      },
      size: {
        sm: 'bl-mde-sm',
        default: 'bl-mde-md',
        lg: 'bl-mde-lg',
      },
    },
    compoundVariants: (['sm', 'default', 'lg'] as const).map((size) => ({
      variant: 'default' as const,
      size,
      // The field box minus its one-line height and inline padding (the document pads itself, `--mde-px`).
      class: [fieldSurfaceVariants({ size }), 'h-auto flex-col items-stretch gap-0 px-0'],
    })),
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/* Read-only keeps the field's rest look while focused (the text is still selectable). */
const readOnlyFocus = 'data-readonly:focus-within:shadow-none data-[variant=default]:data-readonly:focus-within:bg-input data-[variant=card]:data-readonly:focus-within:shadow-hairline';

/** What a MarkdownEditor ref exposes: the editor's commands plus Markdown-level helpers. */
export interface MarkdownEditorHandle {
  /** The TipTap editor (null until mounted). */
  readonly editor: MarkdownEditorInstance | null;
  /** `editor.commands` — toggleBold, setHeading, insertContent, removeAttachment, … */
  readonly commands: MarkdownEditorInstance['commands'] | null;
  /** `editor.chain().focus()` — start a focused command chain. */
  chain: () => ReturnType<MarkdownEditorInstance['chain']> | null;
  focus: (position?: 'start' | 'end' | 'all') => void;
  blur: () => void;
  /** The current document as Markdown. */
  getMarkdown: () => string;
  /** Replaces the document (fires onValueChange). */
  setMarkdown: (markdown: string) => void;
  /** Inserts Markdown at the caret as structure. */
  insertMarkdown: (markdown: string) => void;
  clear: () => void;
  isEmpty: () => boolean;
}

/** Classes for the parts of the document, so a host restyles the editor with ordinary utilities (the editor's
    stylesheet is layered under them; no `!important`). Applied to the live DOM and kept on it as you type. */
export interface MarkdownEditorClassNames {
  /** The editor surface (the flex column holding the toolbar and the writing area). */
  editor?: string;
  /** The writing area (the contenteditable). */
  content?: string;
  /** The first block, whatever it is — a Notes-style title line. */
  title?: string;
  /** Headings (h1–h6) after the first block. */
  heading?: string;
  paragraph?: string;
  /** Bulleted and numbered lists (not checklists). */
  list?: string;
  /** A checklist (`- [ ]` task list). */
  checklist?: string;
  /** One checklist row. Checked rows also carry `data-checked="true"`. */
  checklistItem?: string;
  /** A checklist row's checkbox: Docstream's task checkbox, a `button[role=checkbox]` over the state icon
      (`data-checked` when verified, `data-indeterminate` for the in-between states). */
  checkbox?: string;
  table?: string;
  /** Header cells (`th`). */
  tableHeader?: string;
  /** Body cells (`td`). */
  tableCell?: string;
  blockquote?: string;
  codeBlock?: string;
  link?: string;
  /** The formatting toolbar (`toolbar`). */
  toolbar?: string;
}

/* Slot → selector, relative to the editor surface (.gb). */
const SLOT_SELECTORS: Record<Exclude<keyof MarkdownEditorClassNames, 'editor' | 'content' | 'title'>, string> = {
  heading: '.ProseMirror > :is(h1,h2,h3,h4,h5,h6):not(:first-child)',
  paragraph: '.ProseMirror p',
  list: '.ProseMirror :is(ul:not([data-type="taskList"]), ol)',
  checklist: '.ProseMirror ul[data-type="taskList"]',
  checklistItem: '.ProseMirror ul[data-type="taskList"] > li',
  checkbox: '.ProseMirror ul[data-type="taskList"] > li > .gb-task-control .docs-task-checkbox',
  table: '.ProseMirror table',
  tableHeader: '.ProseMirror th',
  tableCell: '.ProseMirror td',
  blockquote: '.ProseMirror blockquote',
  codeBlock: '.ProseMirror pre',
  link: '.ProseMirror a',
  toolbar: '.gb-toolbar',
};

const splitClasses = (c: string | undefined) => (c ? c.split(/\s+/).filter(Boolean) : []);

/** The editor's DOM, or null while its view isn't mounted: TipTap throws on `view` before it mounts and after it
    unmounts (the editor can arrive, through `onEditorReady`, before its content has mounted — under a Suspense
    boundary, say). */
function editorDom(editor: MarkdownEditorInstance): HTMLElement | null {
  try { return editor.view.dom as HTMLElement; } catch { return null; }
}

/** Runs `fn` once the editor's view is mounted — now, or on its `mount` event. Returns the teardown (`fn`'s own, too). */
function whenMounted(editor: MarkdownEditorInstance, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let ran = false;
  const go = () => {
    if (ran) return;
    ran = true;
    editor.off('mount', go);
    cleanup = fn();
  };
  if (editorDom(editor)) go();
  else editor.on('mount', go);
  return () => { editor.off('mount', go); cleanup?.(); };
}

/** Puts the slot classes on the editor's DOM. ProseMirror's DOM observer is paused meanwhile so the class changes
    don't read as edits; nodes it re-renders lose them and get them back on the next pass (every transaction). */
function applySlotClasses(
  editor: MarkdownEditorInstance,
  slots: MarkdownEditorClassNames,
  applied: Map<Element, string[]>,
) {
  const pm = editorDom(editor);
  if (!pm) return;
  const view = editor.view as unknown as { domObserver?: { stop(): void; start(): void } };
  const surface = pm.closest('.gb') ?? pm.parentElement;
  if (!surface) return;
  const want = new Map<Element, string[]>();
  const add = (el: Element | null | undefined, cls: string | undefined) => {
    const list = splitClasses(cls);
    if (!el || !list.length) return;
    want.set(el, [...(want.get(el) ?? []), ...list]);
  };
  add(surface, slots.editor);
  add(pm, slots.content);
  add(pm.firstElementChild, slots.title);
  for (const [slot, sel] of Object.entries(SLOT_SELECTORS)) {
    const cls = slots[slot as keyof typeof SLOT_SELECTORS];
    if (cls) surface.querySelectorAll(sel).forEach((el) => add(el, cls));
  }
  const same = (a: string[] | undefined, b: string[] | undefined) => (a ?? []).join(' ') === (b ?? []).join(' ');
  let dirty = applied.size !== want.size;
  if (!dirty) for (const [el, list] of want) if (!same(applied.get(el), list) || !list.every((c) => el.classList.contains(c))) { dirty = true; break; }
  if (!dirty) return;
  view.domObserver?.stop();
  try {
    for (const [el, list] of applied) if (!want.has(el)) el.classList.remove(...list);
    for (const [el, list] of want) {
      const prev = applied.get(el);
      if (prev) el.classList.remove(...prev.filter((c) => !list.includes(c)));
      el.classList.add(...list);
    }
  } finally {
    view.domObserver?.start();
  }
  applied.clear();
  for (const [el, list] of want) applied.set(el, list);
}

type MarkdownEditorOwnProps = VariantProps<typeof markdownEditorVariants> & {
  /** First-party YAML frontmatter property sheet. */
  documentProperties?: GitbookEditorProps['documentProperties'];
  /** Markdown (controlled). */
  value?: string;
  /** Initial Markdown (uncontrolled). */
  defaultValue?: string;
  /** Called with the serialized Markdown on every edit, and why (`details.reason`, `details.event`,
   *  `details.source`). `details.cancel()` puts the document back as it was. */
  onValueChange?: (markdown: string, details: MarkdownEditorValueChangeDetails) => void;
  /** ⌘/Ctrl+Enter. Called with the current Markdown. */
  onSubmit?: (markdown: string) => void;
  placeholder?: string;
  /** Not editable, but focusable and selectable; the field chrome stays. */
  readOnly?: boolean;
  /** Not editable and dimmed. Inside a Field, the field's `disabled` applies too. */
  disabled?: boolean;
  autoFocus?: boolean;
  /** The formatting toolbar, hidden while read-only or disabled. `true`: the built-in one, a `<Toolbar>` of
      `MarkdownEditorToolbarButton`s (bold, italic, strikethrough, code, link). A node: a toolbar of your own in the same
      place, usually a `<Toolbar>` of `MarkdownEditorToolbarButton`s. */
  toolbar?: boolean | React.ReactNode;
  /** The "/" block menu: on (default), off, or a custom item list. */
  slashMenu?: GitbookEditorProps['slashMenu'];
  /** @mention / #tag / $codebase pickers: off by default; true for the defaults, or per-trigger sources. */
  references?: GitbookEditorProps['references'];
  /** Live demo blocks (`{% demo %}`): how they resolve and run. The same option MarkdownView takes. */
  demo?: MarkdownEditorDemo;
  /** Parse pasted plain text that looks like Markdown into structure (default true). */
  pasteMarkdown?: boolean;
  /** Pasted or dropped images: inline image blocks (default) or attachment chips the host stores. */
  imagePaste?: 'inline' | 'chip';
  /** Chip mode: the host's attachment store, looked up by id. */
  attachments?: MarkdownEditorAttachment[];
  /** Chip mode: once per pasted/dropped image, with a fresh id, the file and a data URL. Add it to `attachments`. */
  onAttachmentAdd?: GitbookEditorProps['onAttachmentAdd'];
  /** Chip mode: chips deleted, cut or cleared in the editor. */
  onAttachmentRemove?: (ids: string[]) => void;
  /** Chip mode: a chip was clicked. Omit for the built-in image viewer. */
  onAttachmentOpen?: (attachment: MarkdownEditorAttachment) => void;
  /** Resolves asset URLs as written (`./models/part.stl`) to loadable ones, e.g. `blob:` URLs of files next to the document. */
  resolveAsset?: GitbookEditorProps['resolveAsset'];
  /** Adds "Choose file…" to embed blocks (and "Choose image…" to images); resolve with the URL to write. */
  pickFile?: GitbookEditorProps['pickFile'];
  /** Claim a drop: return the URLs to embed at the drop point, or `null` for the default handling. */
  onDropEmbeds?: GitbookEditorProps['onDropEmbeds'];
  /** Runs before the editor's keymaps (ProseMirror's `handleKeyDown`); return true when you handled the key. */
  handleKeyDown?: (event: KeyboardEvent) => boolean;
  /** Runs before the editor's paste handling (ProseMirror's `handlePaste`); return true when you handled it. */
  handlePaste?: (event: ClipboardEvent) => boolean;
  /** The writing area took focus (TipTap's focus, with the DOM `FocusEvent`). React's `onFocus` / `onBlur` are the root's
      and also fire for the toolbar and the editor's popups. */
  onEditorFocus?: (event: FocusEvent) => void;
  /** The writing area lost focus. */
  onEditorBlur?: (event: FocusEvent) => void;
  /** The TipTap editor, once mounted (and null on teardown). */
  onEditorReady?: (editor: MarkdownEditorInstance | null) => void;
  /** Minimum height of the writing area (px or any CSS length). */
  minHeight?: number | string;
  /** Maximum height before the editor scrolls (px or any CSS length). */
  maxHeight?: number | string;
  /** Submits the Markdown with a form under this name (a hidden input). Inside a Field, defaults to the field's. */
  name?: string;
  /** The writing area's id (the contenteditable, which is the field's control). */
  id?: string;
  /** Names the writing area. Inside a Field, its FieldLabel does. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Classes for parts of the document: the writing area, title line, headings, checklists and their checkboxes, tables, … */
  classNames?: MarkdownEditorClassNames;
  ref?: React.Ref<MarkdownEditorHandle>;
};

/** The root `div` takes the rest (`className`, `style`, `data-*`…); `id` and the `aria-*` names go on the writing area. */
export type MarkdownEditorProps = MarkdownEditorOwnProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof MarkdownEditorOwnProps | 'children' | 'onChange' | 'onInput'>;

/* ── A toolbar of your own ── */

const EditorContext = React.createContext<MarkdownEditorInstance | null>(null);

export type MarkdownEditorToolbarButtonProps = Omit<ToolbarButtonProps, 'onClick'> & {
  /** The TipTap command it runs, with no arguments, on the focused editor: `toggleBold`, `toggleItalic`, `toggleStrike`,
      `toggleCode`, `toggleBulletList`, `toggleOrderedList`, `toggleTaskList`, `toggleBlockquote`, `setHorizontalRule`… */
  command: string;
  /** A mark or node (`bold`, `heading`, `taskList`) that makes it a toggle: pressed while the selection is in one. */
  mark?: string;
  /** With `mark`: its attributes (`{ level: 2 }` for a second-level heading). */
  attributes?: Record<string, unknown>;
};

/** A ToolbarButton for a MarkdownEditor's own `toolbar`: runs `command` on the editor and, given a `mark`, is a
    ToolbarToggle that is pressed (`aria-pressed`, filled) while the selection is in it. Give an icon-only one an
    `aria-label`. */
export function MarkdownEditorToolbarButton({ command, mark, attributes, size = 'icon-sm', ...props }: MarkdownEditorToolbarButtonProps) {
  const editor = React.useContext(EditorContext);
  const subscribe = React.useCallback((notify: () => void) => {
    if (!editor || !mark) return () => {};
    editor.on('transaction', notify);
    return () => { editor.off('transaction', notify); };
  }, [editor, mark]);
  const pressed = React.useSyncExternalStore(subscribe, () => (editor && mark ? editor.isActive(mark, attributes) : false), () => false);
  const run = () => {
    const chain = editor?.chain().focus() as unknown as Record<string, (() => { run: () => boolean }) | undefined> | undefined;
    chain?.[command]?.().run();
  };
  if (mark) {
    // A toggle: the editor's selection decides `pressed`; a press runs the command, which moves it.
    // A ToolbarButton's look (`variant`, `tone`) isn't a toggle's: the toggle keeps the toolbar's quiet look.
    const rest: Record<string, unknown> = { ...props };
    delete rest.variant;
    delete rest.tone;
    const toggleSize = size === 'pill' ? undefined : size;
    return (
      <ToolbarToggle
        size={toggleSize}
        disabled={!editor}
        {...(rest as Omit<ToolbarToggleProps, 'size'>)}
        pressed={pressed}
        onPressedChange={run}
      />
    );
  }
  return <ToolbarButton size={size} disabled={!editor} {...props} onClick={run} />;
}

/** The link button of the built-in toolbar: a popover with the URL, Apply and Remove (pressed while the caret is in a
    link). */
function MarkdownEditorLinkButton() {
  const editor = React.useContext(EditorContext);
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const subscribe = React.useCallback((notify: () => void) => {
    if (!editor) return () => {};
    editor.on('transaction', notify);
    return () => { editor.off('transaction', notify); };
  }, [editor]);
  const inLink = React.useSyncExternalStore(subscribe, () => (editor ? editor.isActive('link') : false), () => false);
  const inLinkId = React.useId();
  const close = () => setOpen(false);
  const chain = () => editor?.chain().focus() as unknown as { setLink(a: { href: string }): { run(): boolean }; unsetLink(): { run(): boolean } } | undefined;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl(String(editor?.getAttributes('link').href ?? ''));
        setOpen(next);
      }}
    >
      {/* A popup trigger can't also be a toggle (`aria-pressed`): it is filled like a pressed ToolbarToggle while the
          caret is in a link, and says so in its description. */}
      <ToolbarButton
        size="icon-sm"
        disabled={!editor}
        aria-label="Link"
        aria-describedby={inLink ? inLinkId : undefined}
        data-pressed={inLink || undefined}
        className="data-pressed:bg-secondary data-pressed:text-foreground"
        render={<PopoverTrigger />}
      >
        <Icon name="link" size={16} />
        <span id={inLinkId} hidden>In a link</span>
      </ToolbarButton>
      <PopoverContent aria-label="Link" className="w-72 p-2">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const href = url.trim();
            (href ? chain()?.setLink({ href }) : chain()?.unsetLink())?.run();
            close();
          }}
        >
          <Input size="sm" aria-label="URL" placeholder="https://…" value={url} onValueChange={setUrl} className="min-w-0 flex-1" />
          <Button type="submit" size="sm">Apply</Button>
          <Button type="button" size="sm" variant="ghost" disabled={!inLink} onClick={() => { chain()?.unsetLink().run(); close(); }}>
            Remove
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** `toolbar={true}`: the kit's Toolbar of MarkdownEditorToolbarButtons, the same parts a toolbar of your own is made of.
    Bold, italic, strikethrough and code are drawn as letters, as the system's format bar draws them. */
function MarkdownEditorDefaultToolbar() {
  return (
    <Toolbar aria-label="Formatting" size="sm" className="w-full">
      <MarkdownEditorToolbarButton command="toggleBold" mark="bold" aria-label="Bold"><span aria-hidden="true" className="font-bold">B</span></MarkdownEditorToolbarButton>
      <MarkdownEditorToolbarButton command="toggleItalic" mark="italic" aria-label="Italic"><span aria-hidden="true" className="font-serif italic">I</span></MarkdownEditorToolbarButton>
      <MarkdownEditorToolbarButton command="toggleStrike" mark="strike" aria-label="Strikethrough"><span aria-hidden="true" className="line-through">S</span></MarkdownEditorToolbarButton>
      <MarkdownEditorToolbarButton command="toggleCode" mark="code" aria-label="Inline code"><span aria-hidden="true" className="font-mono text-footnote">{'</>'}</span></MarkdownEditorToolbarButton>
      <MarkdownEditorLinkButton />
      {/* A tip, not a control: the kit's muted text, and only where the bar has room for it. */}
      <ToolbarText className="ms-auto hidden @md/mde-toolbar:inline">
        Type <kbd className="font-mono">/</kbd> for blocks
      </ToolbarText>
    </Toolbar>
  );
}

/** Sets a callback or object ref. */
function setRef<T>(ref: React.Ref<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as React.RefObject<T | null>).current = value;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

/**
 * A Markdown field on the Docstream editor: WYSIWYG blocks, "/" commands, Markdown paste, inline or chip image
 * paste. Controlled (`value`) or uncontrolled (`defaultValue`); the ref exposes the editor's commands.
 */
export function MarkdownEditor({
    ref,
    value,
    defaultValue = '',
    onValueChange,
    onSubmit,
    placeholder,
    readOnly = false,
    disabled: disabledProp = false,
    autoFocus = false,
    toolbar = false,
    documentProperties,
    slashMenu = true,
    references = false,
    demo,
    pasteMarkdown = true,
    imagePaste = 'inline',
    attachments,
    onAttachmentAdd,
    onAttachmentRemove,
    onAttachmentOpen,
    resolveAsset,
    pickFile,
    onDropEmbeds,
    handleKeyDown: onKeyDownHook,
    handlePaste: onPasteHook,
    onEditorFocus,
    onEditorBlur,
    onEditorReady,
    minHeight,
    maxHeight,
    name: nameProp,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    variant,
    size,
    className,
    classNames,
    style,
    ...props
}: MarkdownEditorProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue);
  const markdown = controlled ? value : inner;
  const [editor, setEditor] = React.useState<MarkdownEditorInstance | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // Inside a UI SDK Field: its name, disabled state, and the ids and validity its control slot hands out.
  const field = useFieldControl({ id });
  const fieldProps = field?.props({ id, 'aria-labelledby': ariaLabelledby, 'aria-describedby': ariaDescribedby }) as
    | (Record<string, unknown> & { ref?: React.Ref<HTMLElement> })
    | undefined;
  const disabled = disabledProp || !!field?.disabled;
  const invalid = fieldProps?.['aria-invalid'] === 'true' || fieldProps?.['aria-invalid'] === true;
  const name = nameProp ?? field?.name;
  const controlId = (fieldProps?.id as string | undefined) ?? id;
  const labelledBy = (fieldProps?.['aria-labelledby'] as string | undefined) ?? ariaLabelledby;
  const describedBy = (fieldProps?.['aria-describedby'] as string | undefined) ?? ariaDescribedby;
  const fieldRef = React.useRef(fieldProps?.ref);
  fieldRef.current = fieldProps?.ref;
  const editable = !readOnly && !disabled;
  const ownToolbar = toolbar !== true && toolbar !== false && toolbar != null;

  // Handlers the editor captured at creation read the latest props through here.
  const latest = React.useRef({ markdown, onValueChange, onSubmit, onKeyDown: onKeyDownHook, onPaste: onPasteHook, pasteMarkdown, onReady: onEditorReady, controlled });
  latest.current = { markdown, onValueChange, onSubmit, onKeyDown: onKeyDownHook, onPaste: onPasteHook, pasteMarkdown, onReady: onEditorReady, controlled };

  // Why the next change happens: a call through the ref says so while it runs; otherwise it is an edit, caused by
  // the input event seen last in this task (a key, a paste, a drop, a toolbar press).
  const imperative = React.useRef(false);
  const lastInput = React.useRef<Event | undefined>(undefined);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const seen = (event: Event) => {
      lastInput.current = event;
      clearTimeout(clear);
      clear = setTimeout(() => (lastInput.current = undefined));
    };
    const types = ['keydown', 'beforeinput', 'input', 'paste', 'drop', 'cut', 'click'];
    for (const t of types) root.addEventListener(t, seen, true);
    return () => {
      clearTimeout(clear);
      for (const t of types) root.removeEventListener(t, seen, true);
    };
  }, []);
  const asImperative = (run: () => void) => {
    imperative.current = true;
    try {
      run();
    } finally {
      imperative.current = false;
    }
  };

  const handleChange = React.useCallback((md: string) => {
    const previous = latest.current.markdown;
    const details = changeDetails<MarkdownEditorValueChangeReason>(
      imperative.current ? { reason: 'imperative' } : { reason: 'input-change', event: lastInput.current },
    );
    latest.current.onValueChange?.(md, details);
    if (details.canceled) {
      // Put the document back as it was, without reporting that as a change.
      const ed = editorRef.current;
      if (ed && !ed.isDestroyed) ed.commands.setContent(astToTiptap(parseMarkdown(previous)), { emitUpdate: false });
      return;
    }
    latest.current.markdown = md;
    if (!latest.current.controlled) setInner(md);
  }, []);

  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (latest.current.onKeyDown?.(event)) return true;
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && latest.current.onSubmit) {
      latest.current.onSubmit(latest.current.markdown);
      return true;
    }
    return false;
  }, []);

  const editorRef = React.useRef<MarkdownEditorInstance | null>(null);
  const handlePaste = React.useCallback((event: ClipboardEvent) => {
    if (latest.current.onPaste?.(event)) return true;
    const ed = editorRef.current;
    if (!latest.current.pasteMarkdown || !ed) return false;
    const data = event.clipboardData;
    // Images belong to the editor (imagePaste); code blocks take text verbatim.
    if (data && Array.from(data.files ?? []).some((f) => f.type.startsWith('image/'))) return false;
    if (ed.state.selection.$from.parent.type.spec.code) return false;
    const text = data?.getData('text/plain') ?? '';
    if (!looksLikeMarkdown(text)) return false;
    return insertMarkdown(ed, text);
  }, []);

  const handleReady = React.useCallback((ed: MarkdownEditorInstance | null) => {
    editorRef.current = ed;
    setEditor(ed);
    latest.current.onReady?.(ed);
  }, []);

  // useEditor keeps `editable` from creation; follow the props.
  React.useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  // ARIA on the contenteditable itself, so a <Label>, aria-describedby or the Field around it reach the field.
  React.useEffect(() => {
    if (!editor) return;
    return whenMounted(editor, () => {
      const dom = editorDom(editor);
      if (!dom) return;
      const attrs: Record<string, string | undefined> = {
        id: controlId,
        'aria-label': ariaLabel,
        'aria-labelledby': labelledBy,
        'aria-describedby': describedBy,
        'aria-invalid': invalid ? 'true' : undefined,
        'aria-readonly': readOnly ? 'true' : undefined,
        'aria-disabled': disabled ? 'true' : undefined,
        'aria-placeholder': placeholder,
      };
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined) dom.removeAttribute(k);
        else dom.setAttribute(k, v);
      }
      // Tell the field which element is its control.
      const ref = fieldRef.current;
      if (!ref) return;
      setRef(ref, dom);
      return () => setRef(ref, null);
    });
  }, [editor, controlId, ariaLabel, labelledBy, describedBy, invalid, readOnly, disabled, placeholder, !!field]);

  React.useEffect(() => {
    if (!editor) return;
    const f = ({ event }: { event: FocusEvent }) => onEditorFocus?.(event);
    const b = ({ event }: { event: FocusEvent }) => onEditorBlur?.(event);
    editor.on('focus', f);
    editor.on('blur', b);
    return () => {
      editor.off('focus', f);
      editor.off('blur', b);
    };
  }, [editor, onEditorFocus, onEditorBlur]);

  React.useImperativeHandle(
    ref,
    (): MarkdownEditorHandle => ({
      get editor() {
        return editorRef.current;
      },
      get commands() {
        return editorRef.current?.commands ?? null;
      },
      chain: () => editorRef.current?.chain().focus() ?? null,
      focus: (position = 'end') => {
        editorRef.current?.commands.focus(position);
      },
      blur: () => {
        editorRef.current?.commands.blur();
      },
      getMarkdown: () => latest.current.markdown,
      setMarkdown: (md) => {
        const ed = editorRef.current;
        if (!ed) return;
        asImperative(() => ed.commands.setContent(astToTiptap(parseMarkdown(md)), { emitUpdate: true }));
      },
      insertMarkdown: (md) => {
        const ed = editorRef.current;
        if (!ed) return;
        ed.commands.focus();
        asImperative(() => insertMarkdown(ed, md));
      },
      clear: () => {
        const ed = editorRef.current;
        if (ed) asImperative(() => ed.commands.clearContent(true));
      },
      isEmpty: () => editorRef.current?.isEmpty ?? !latest.current.markdown.trim(),
    }),
    [],
  );

  // Slot classes onto the live document, re-applied after every transaction (ProseMirror re-renders nodes).
  const slotKey = JSON.stringify(classNames ?? null);
  React.useEffect(() => {
    if (!editor) return;
    return whenMounted(editor, () => {
      const slots: MarkdownEditorClassNames = { ...classNames };
      const applied = new Map<Element, string[]>();
      const dom = editorDom(editor);
      if (!dom) return;
      const run = () => { if (!editor.isDestroyed) applySlotClasses(editor, slots, applied); };
      run();
      // Node views that render on their own schedule (React ones, tables) add DOM outside a transaction: re-apply on
      // the next frame after any child-list change (class changes are attribute mutations, so this doesn't loop).
      // (A timeout rather than a frame: frames don't run in background tabs or under a paused clock.)
      let raf: ReturnType<typeof setTimeout> | undefined;
      const later = () => { clearTimeout(raf); raf = setTimeout(run, 16); };
      const onTx = () => { run(); later(); };
      editor.on('transaction', onTx);
      const surface = dom.closest('.gb') ?? dom;
      const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => { run(); later(); });
      mo?.observe(surface, { childList: true, subtree: true });
      return () => {
        editor.off('transaction', onTx);
        mo?.disconnect();
        clearTimeout(raf);
        if (editor.isDestroyed) return;
        applySlotClasses(editor, {}, applied);
      };
    });
  }, [editor, slotKey]);

  return (
    <div
      {...props}
      ref={rootRef}
      data-slot="markdown-editor"
      data-variant={variant ?? 'default'}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-toolbar={(toolbar !== false && toolbar != null && editable) || undefined}
      className={cn(markdownEditorVariants({ variant, size }), readOnlyFocus, className)}
      style={{
        ...(minHeight !== undefined ? { '--mde-min-h': len(minHeight) } : {}),
        ...(maxHeight !== undefined ? { '--mde-max-h': len(maxHeight) } : {}),
        ...style,
      } as React.CSSProperties}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        // Clicks on the field's padding focus the end of the document, as a textarea would.
        const t = e.target as HTMLElement;
        if (editable && (t === e.currentTarget || t.matches('.gb-content, .bl-mde-doc'))) {
          e.preventDefault();
          editorRef.current?.commands.focus('end');
        }
      }}
    >
      {(ownToolbar || toolbar === true) && editable ? (
        <EditorContext.Provider value={editor}>
          <div
            data-slot="markdown-editor-toolbar"
            className="@container/mde-toolbar flex flex-none items-center px-1.5 py-1 shadow-hairline-b group-data-[variant=plain]/mde:mb-2 group-data-[variant=plain]/mde:px-0"
          >
            {toolbar === true ? <MarkdownEditorDefaultToolbar /> : toolbar}
          </div>
        </EditorContext.Provider>
      ) : null}
      <GitbookEditor
        markdown={markdown}
        onValueChange={handleChange}
        toolbar={false}
        documentProperties={documentProperties}
        slashMenu={slashMenu}
        references={references}
        demoResolver={demo?.resolver}
        demoRuntime={demo?.runtime}
        demoVFS={demo?.vfs}
        demoDependencies={demo?.dependencies}
        editable={editable}
        {...(placeholder !== undefined ? { placeholder } : {})}
        autoFocus={autoFocus}
        className="bl-mde-doc"
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        imagePaste={imagePaste}
        {...(attachments ? { attachments } : {})}
        {...(onAttachmentAdd ? { onAttachmentAdd } : {})}
        {...(onAttachmentRemove ? { onAttachmentRemove } : {})}
        {...(onAttachmentOpen ? { onAttachmentOpen } : {})}
        {...(resolveAsset ? { resolveAsset } : {})}
        {...(pickFile ? { pickFile } : {})}
        {...(onDropEmbeds ? { onDropEmbeds } : {})}
        onEditorReady={handleReady}
      />
      {name !== undefined ? <input type="hidden" name={name} value={markdown} disabled={disabled} /> : null}
    </div>
  );
}
