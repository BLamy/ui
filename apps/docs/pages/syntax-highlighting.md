# SyntaxHighlighting

This is [CodeEditor](https://blamy.github.io/ui/#/code-editor) now. `SyntaxHighlighting` and its parts still work, so nothing has to change today, but each is a thin wrapper that calls `CodeEditor` with `readOnly`, and new code should use `CodeEditor`.

| Old | New |
| --- | --- |
| `<SyntaxHighlighting code={source} … />` | `<CodeEditor readOnly value={source} … />` |
| `SyntaxHighlightingHeader`, `Title`, `CopyButton`, `Content` | `CodeEditorHeader`, `Title`, `CopyButton`, `Content` |
| `SyntaxHighlightingContent code={source}` | `CodeEditorContent value={source}` |
| `syntaxHighlightingVariants` | `codeEditorVariants` |
| `useSyntaxHighlighting()`, with `code` | `useCodeEditor()`, with `getValue()` |
| `SyntaxLineRange`, `SyntaxToken`, `SyntaxTokenType` | `CodeLineRange`, `CodeToken`, `CodeTokenType` |

`useSyntaxTokens`, `SyntaxTokens` and everything in `lib/syntax` keep their names. Blocks build diffs from them.

Its registry item stays too, so `npx shadcn@latest add https://blamy.github.io/ui/r/syntax-highlighting.json` keeps working, and brings CodeEditor with it.
