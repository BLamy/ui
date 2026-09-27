import * as React from 'react';
import { GitbookEditor, type GitbookEditorProps } from '@brett_lamy/docstream-editor/editor';
import type { EditorAttachment } from '@brett_lamy/docstream-editor';
import { astToTiptap } from '@brett_lamy/docstream-editor/convert';
import { parseMarkdown } from '@brett_lamy/docstream/gitbook';
import '@brett_lamy/docstream-editor/styles.css';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ MarkdownEditor — a themed field over the Docstream (TipTap) editor ══

   <MarkdownEditor defaultValue="# Notes" onValueChange={setMarkdown} />

   The value is GitBook-flavored Markdown, the same dialect MarkdownView renders. Type "/" for blocks, paste
   Markdown to get structure, paste or drop images inline or as attachment chips. Colors come from the
   surrounding --bl-* tokens (BLProvider, AppearanceProvider), and the editor's own popovers — the slash menu
   and the chip hover card, which live on <body> — are dressed in the same tokens while this editor owns them. */

/** The TipTap editor instance behind a MarkdownEditor. */
export type MarkdownEditorInstance = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;
export type MarkdownEditorAttachment = EditorAttachment;

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
        /** A filled field, like Input and Textarea: tint ring while editing. */
        default:
          'rounded-[10px] bg-input focus-within:bg-transparent focus-within:shadow-[inset_0_0_0_1.5px_var(--bl-tint)] data-readonly:focus-within:bg-input data-readonly:focus-within:shadow-none data-invalid:shadow-[inset_0_0_0_1.5px_var(--bl-red)]',
        /** No chrome: text on the surface it sits on (inline notes, full-page documents). */
        ghost: 'rounded-none bg-transparent',
        /** A raised card with a hairline, for editors that stand on their own. */
        card: 'rounded-[14px] bg-card shadow-[0_0_0_1px_var(--bl-sep),0_1px_2px_rgba(0,0,0,.04)] focus-within:shadow-[0_0_0_1.5px_var(--bl-tint),0_1px_2px_rgba(0,0,0,.04)] data-readonly:focus-within:shadow-[0_0_0_1px_var(--bl-sep),0_1px_2px_rgba(0,0,0,.04)] data-invalid:shadow-[0_0_0_1.5px_var(--bl-red)]',
      },
      size: {
        sm: 'bl-mde-sm',
        default: 'bl-mde-md',
        lg: 'bl-mde-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

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

export interface MarkdownEditorProps extends VariantProps<typeof markdownEditorVariants> {
  /** Markdown (controlled). */
  value?: string;
  /** Initial Markdown (uncontrolled). */
  defaultValue?: string;
  /** Called with serialized Markdown on every edit. */
  onValueChange?: (markdown: string) => void;
  /** ⌘/Ctrl+Enter. Called with the current Markdown. */
  onSubmit?: (markdown: string) => void;
  placeholder?: string;
  /** Not editable, but focusable and selectable; the field chrome stays. */
  readOnly?: boolean;
  /** Not editable and dimmed. */
  disabled?: boolean;
  /** Marks the field invalid (red ring, aria-invalid). */
  invalid?: boolean;
  autoFocus?: boolean;
  /** The formatting toolbar (bold, italic, strike, code, link). Hidden while read-only or disabled. */
  toolbar?: boolean;
  /** The "/" block menu: on (default), off, or a custom item list. */
  slashMenu?: GitbookEditorProps['slashMenu'];
  /** @mention / #tag / $codebase pickers: off by default; true for the defaults, or per-trigger sources. */
  references?: GitbookEditorProps['references'];
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
  /** Runs before the editor's keymaps; return true when handled. */
  onKeyDown?: (event: KeyboardEvent) => boolean;
  /** Runs before the editor's paste handling; return true when handled. */
  onPaste?: (event: ClipboardEvent) => boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** The TipTap editor, once mounted (and null on teardown). */
  onEditorReady?: (editor: MarkdownEditorInstance | null) => void;
  /** Minimum height of the writing area (px or any CSS length). */
  minHeight?: number | string;
  /** Maximum height before the editor scrolls (px or any CSS length). */
  maxHeight?: number | string;
  /** Submits the Markdown with a form under this name (a hidden input). */
  name?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  className?: string;
  style?: React.CSSProperties;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);

/* Token names the editor's stylesheet reads outside .gb (its popovers). Copied from the editor's resolved
   values onto each popover it portals to <body>, so the menu matches the surface the editor sits on. */
const PORTAL_TOKENS = [
  '--popover', '--popover-foreground', '--card', '--card-foreground', '--foreground', '--border', '--muted',
  '--muted-foreground', '--accent', '--accent-foreground', '--primary',
];

function usePortalTheme(root: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver((records) => {
      const el = root.current;
      if (!el || !(el.matches(':focus-within') || el.matches(':hover'))) return;
      const cs = getComputedStyle(el);
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement) || !n.matches('.react-renderer, .gb-attachment-card')) return;
          for (const t of PORTAL_TOKENS) n.style.setProperty(t, cs.getPropertyValue(t));
          n.style.colorScheme = cs.colorScheme;
          n.dataset.scheme = /dark/.test(cs.colorScheme) && !/light/.test(cs.colorScheme) ? 'dark' : 'light';
          n.style.fontFamily = cs.fontFamily;
          n.dataset.markdownEditorPortal = '';
        });
    });
    obs.observe(document.body, { childList: true });
    return () => obs.disconnect();
  }, [root]);
}

/**
 * A Markdown field on the Docstream editor: WYSIWYG blocks, "/" commands, Markdown paste, inline or chip image
 * paste. Controlled (`value`) or uncontrolled (`defaultValue`); the ref exposes the editor's commands.
 */
export const MarkdownEditor = React.forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  {
    value,
    defaultValue = '',
    onValueChange,
    onSubmit,
    placeholder,
    readOnly = false,
    disabled = false,
    invalid = false,
    autoFocus = false,
    toolbar = false,
    slashMenu = true,
    references = false,
    pasteMarkdown = true,
    imagePaste = 'inline',
    attachments,
    onAttachmentAdd,
    onAttachmentRemove,
    onAttachmentOpen,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    onEditorReady,
    minHeight,
    maxHeight,
    name,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    variant,
    size,
    className,
    style,
  },
  ref,
) {
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue);
  const markdown = controlled ? value : inner;
  const [editor, setEditor] = React.useState<MarkdownEditorInstance | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const editable = !readOnly && !disabled;

  // Handlers the editor captured at creation read the latest props through here.
  const latest = React.useRef({ markdown, onValueChange, onSubmit, onKeyDown, onPaste, pasteMarkdown, onReady: onEditorReady, controlled });
  latest.current = { markdown, onValueChange, onSubmit, onKeyDown, onPaste, pasteMarkdown, onReady: onEditorReady, controlled };

  const handleChange = React.useCallback((md: string) => {
    latest.current.markdown = md;
    if (!latest.current.controlled) setInner(md);
    latest.current.onValueChange?.(md);
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

  // ARIA on the contenteditable itself, so a <Label> / aria-describedby reach the field.
  React.useEffect(() => {
    const dom = editor?.view.dom as HTMLElement | undefined;
    if (!dom) return;
    const attrs: Record<string, string | undefined> = {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
      'aria-invalid': invalid ? 'true' : undefined,
      'aria-readonly': readOnly ? 'true' : undefined,
      'aria-disabled': disabled ? 'true' : undefined,
      'aria-placeholder': placeholder,
    };
    for (const [k, v] of Object.entries(attrs)) (v === undefined ? dom.removeAttribute(k) : dom.setAttribute(k, v));
  }, [editor, id, ariaLabel, ariaLabelledby, ariaDescribedby, invalid, readOnly, disabled, placeholder]);

  React.useEffect(() => {
    if (!editor) return;
    const f = () => onFocus?.();
    const b = () => onBlur?.();
    editor.on('focus', f);
    editor.on('blur', b);
    return () => {
      editor.off('focus', f);
      editor.off('blur', b);
    };
  }, [editor, onFocus, onBlur]);

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
        ed.commands.setContent(astToTiptap(parseMarkdown(md)), { emitUpdate: true });
      },
      insertMarkdown: (md) => {
        const ed = editorRef.current;
        if (!ed) return;
        ed.commands.focus();
        insertMarkdown(ed, md);
      },
      clear: () => {
        editorRef.current?.commands.clearContent(true);
      },
      isEmpty: () => editorRef.current?.isEmpty ?? !latest.current.markdown.trim(),
    }),
    [],
  );

  usePortalTheme(rootRef);

  return (
    <div
      ref={rootRef}
      data-slot="markdown-editor"
      data-variant={variant ?? 'default'}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
      data-toolbar={(toolbar && editable) || undefined}
      className={cn(markdownEditorVariants({ variant, size }), className)}
      style={{
        ...(minHeight !== undefined ? { '--mde-min-h': len(minHeight) } : {}),
        ...(maxHeight !== undefined ? { '--mde-max-h': len(maxHeight) } : {}),
        ...style,
      } as React.CSSProperties}
      onPointerDown={(e) => {
        // Clicks on the field's padding focus the end of the document, as a textarea would.
        const t = e.target as HTMLElement;
        if (editable && (t === e.currentTarget || t.matches('.gb-content, .bl-mde-doc'))) {
          e.preventDefault();
          editorRef.current?.commands.focus('end');
        }
      }}
    >
      <GitbookEditor
        markdown={markdown}
        onChange={handleChange}
        toolbar={toolbar && editable}
        slashMenu={slashMenu}
        references={references}
        editable={editable}
        {...(placeholder !== undefined ? { placeholder } : {})}
        autofocus={autoFocus}
        className="bl-mde-doc"
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        imagePaste={imagePaste}
        {...(attachments ? { attachments } : {})}
        {...(onAttachmentAdd ? { onAttachmentAdd } : {})}
        {...(onAttachmentRemove ? { onAttachmentRemove } : {})}
        {...(onAttachmentOpen ? { onAttachmentOpen } : {})}
        onEditorReady={handleReady}
      />
      {name !== undefined ? <input type="hidden" name={name} value={markdown} disabled={disabled} /> : null}
    </div>
  );
});
