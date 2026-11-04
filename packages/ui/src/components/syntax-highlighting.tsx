'use client';
import { useMemo, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  CodeEditor, CodeEditorContent, CodeEditorCopyButton, CodeEditorHeader, CodeEditorTitle, SyntaxTokens, codeEditorVariants, useCodeEditor, useSyntaxTokens,
  type CodeEditorContentProps, type CodeEditorCopyButtonProps, type CodeEditorHandle, type CodeEditorProps, type SyntaxTokensState, type UseSyntaxTokensOptions,
} from '@/components/ui/code-editor';
import type { CodeLineRange } from '@/lib/code-editor-model';
import type { SyntaxEngine } from '@/lib/syntax';

/* ══ SyntaxHighlighting — the name CodeEditor's read-only snippets had first. Every part here calls CodeEditor with `readOnly`,
   so apps that use these names keep working, on the one implementation. New code should use CodeEditor. ══ */

export { SyntaxTokens, useSyntaxTokens };
export type { SyntaxTokensState, UseSyntaxTokensOptions };

/** @deprecated Use `CodeLineRange`. */
export type SyntaxLineRange = CodeLineRange;

/** @deprecated Use `codeEditorVariants`. */
export const syntaxHighlightingVariants = codeEditorVariants;

/** @deprecated Use `useCodeEditor`, whose `getValue()` is the text as it is now. The enclosing SyntaxHighlighting's `code`, `language`, `variant`, `title` and `engine`. */
export function useSyntaxHighlighting() {
  const editor = useCodeEditor();
  const code = editor?.getValue();
  return useMemo(
    () => (editor ? { code: code as string, language: editor.language, variant: editor.variant, title: editor.title, engine: editor.engine } : null),
    [code, editor],
  );
}

/** @deprecated Use `CodeEditorContentProps`. */
export interface SyntaxHighlightingContentProps extends Omit<CodeEditorContentProps, 'value' | 'lineNumbers' | 'highlight' | 'tabSize' | 'lineHeight'> {
  /** Defaults to the enclosing SyntaxHighlighting's `code`. */
  code?: string;
  /** Show a line-number gutter (numbers are drawn with CSS, so they aren't copied). */
  lineNumbers?: boolean;
  /** `false` renders plain text and never lexes. */
  highlight?: boolean;
}

/** @deprecated Use `CodeEditorContent`. */
export function SyntaxHighlightingContent({ code, ...props }: SyntaxHighlightingContentProps) {
  return <CodeEditorContent value={code} data-slot="syntax-highlighting-content" {...(props as CodeEditorContentProps)} />;
}

/** @deprecated Use `CodeEditorHeader`. */
export function SyntaxHighlightingHeader(props: ComponentProps<'div'>) {
  return <CodeEditorHeader data-slot="syntax-highlighting-header" {...props} />;
}

/** @deprecated Use `CodeEditorTitle`. */
export function SyntaxHighlightingTitle(props: ComponentProps<'span'>) {
  return <CodeEditorTitle data-slot="syntax-highlighting-title" {...props} />;
}

/** @deprecated Use `CodeEditorCopyButtonProps`. */
export type SyntaxHighlightingCopyButtonProps = CodeEditorCopyButtonProps;

/** @deprecated Use `CodeEditorCopyButton`. */
export function SyntaxHighlightingCopyButton(props: SyntaxHighlightingCopyButtonProps) {
  return <CodeEditorCopyButton data-slot="syntax-highlighting-copy" {...props} />;
}

/** @deprecated Use `CodeEditorProps`. */
export interface SyntaxHighlightingProps extends Omit<ComponentProps<'div'>, 'title' | 'ref'> {
  ref?: Ref<CodeEditorHandle>;
  code: string;
  /** Language id (`ts`, `tsx`, `json`, `css`, `bash`, `diff`, …). Shown in the header; `text` disables lexing.
      gpu-lexer detects the language on its own. */
  language?: string;
  /** A card, no chrome, or an inline `<code>` span. */
  variant?: 'default' | 'ghost' | 'inline';
  /** Header title, usually a filename. */
  title?: ReactNode;
  /** Show a copy button (in the header, or floating top-right when there is no title). */
  showCopy?: boolean;
  /** Force the token palette to light or dark. Defaults to the ambient AppearanceProvider, else the color scheme. */
  appearance?: 'light' | 'dark';
  /** Class for the inner `<pre>`. */
  contentClassName?: string;
  lineNumbers?: boolean;
  startLine?: number;
  highlightLines?: readonly CodeLineRange[];
  addedLines?: readonly CodeLineRange[];
  removedLines?: readonly CodeLineRange[];
  wrap?: boolean;
  maxHeight?: number | string;
  lineProps?: CodeEditorContentProps['lineProps'];
  highlight?: boolean;
  engine?: SyntaxEngine;
}

/** @deprecated Use `CodeEditor` with `readOnly`. */
export function SyntaxHighlighting({ code, ...props }: SyntaxHighlightingProps) {
  const editorProps = { readOnly: true, value: code, ...props } as CodeEditorProps;
  return <CodeEditor data-slot="syntax-highlighting" {...editorProps} />;
}
