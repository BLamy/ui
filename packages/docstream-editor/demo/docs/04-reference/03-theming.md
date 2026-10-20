---
description: The editor's --gb-* tokens, the host tokens they read, the hint and syntax palettes, the classes you can target, and how to theme one editor or a whole app.
---

# Theming

`@brett_lamy/docstream-editor/styles.css` uses the same token contract as docstream's renderer. Every color on the `.gb` wrapper is declared as `var(--host-token, fallback)`. In an app with shadcn-style variables, the editor takes its colors from your theme. Without them, it falls back to a neutral light theme. There's nothing to configure, and the stylesheet avoids `oklch()` and `color-mix()`, so it renders the same in older Chromium forks.

{% demo src="ref-theming/tokens" %}

## Host tokens

Define these on `:root` (or any ancestor of the editor) and both the editor and docstream's renderer follow them. Values must be complete colors (`#7c3aed`, `rgb(…)`, `hsl(262 83% 58%)`). The editor uses them as they are, so a bare shadcn v3 channel triplet like `262 83% 58%` doesn't work.

| Host token | Feeds | Used for |
| --- | --- | --- |
| `--card` | `--gb-panel` | The editor surface and block panels. |
| `--background` | `--gb-bg` | Active tabs, pill switches, toggles that sit on a muted strip. |
| `--foreground` | `--gb-text`, `--gb-code-fg` | Body text and code. |
| `--border` | `--gb-border` | Every rule, outline and divider. |
| `--muted` | `--gb-muted` | Toolbar, block headers, quiet fills. |
| `--muted-foreground` | `--gb-muted-foreground` | Secondary text, icons, placeholders. |
| `--accent`, `--accent-foreground` | `--gb-accent`, `--gb-accent-foreground` | Hover and active states (toolbar buttons, menu items). |
| `--primary` | `--gb-primary` | Links, focus outlines, file-picker buttons. |
| `--popover`, `--popover-foreground` | — (read directly) | The `/` and `@` / `#` / `$` menus. |
| `--card-foreground`, `--font-sans` | — (read directly) | The attachment hover card. |

{% hint style="warning" %}
The slash and reference menus and the attachment hover card are rendered into `document.body`, outside `.gb`. They read host tokens from `:root`, not from a wrapper. If you theme one editor with a scoped wrapper (below), those popups keep the page-level theme.
{% endhint %}

## Editor tokens

Declared on `.gb`, so override them on `.gb` itself (or `.your-class.gb`), not on an ancestor:

| Token | Default | Purpose |
| --- | --- | --- |
| `--gb-panel` | `var(--card, #ffffff)` | Surface. |
| `--gb-muted` | `var(--muted, #f4f4f5)` | Quiet fill. |
| `--gb-muted-foreground` | `var(--muted-foreground, #6b7280)` | Secondary text. |
| `--gb-border` | `var(--border, #e5e7eb)` | Lines. |
| `--gb-accent` | `var(--accent, #f4f4f5)` | Hover / active fill. |
| `--gb-accent-foreground` | `var(--accent-foreground, #18181b)` | Text on the accent. |
| `--gb-primary` | `var(--primary, #2563eb)` | Brand color. |
| `--gb-text` | `var(--foreground, #111827)` | Body text. |
| `--gb-bg` | `var(--background, #ffffff)` | Raised items on a muted strip (active tab, toggle). |
| `--gb-code-bg` | `rgba(128, 128, 128, 0.13)` | Inline code and code-block fill. |
| `--gb-code-fg` | `var(--foreground, #111827)` | Code text. |
| `--gb-radius` | `12px` | Block corner radius. |

### Hint palette

The same palette as docstream's renderer, so a hint looks the same while you write it and once it's published:

| Style | Solid | Border | Background |
| --- | --- | --- | --- |
| `info` | `--gb-info: #3b82f6` | `--gb-info-border: rgba(59, 130, 246, 0.45)` | `--gb-info-bg: rgba(59, 130, 246, 0.1)` |
| `success` | `--gb-success: #22c55e` | `--gb-success-border: rgba(34, 197, 94, 0.45)` | `--gb-success-bg: rgba(34, 197, 94, 0.1)` |
| `warning` | `--gb-warning: #f59e0b` | `--gb-warning-border: rgba(245, 158, 11, 0.5)` | `--gb-warning-bg: rgba(245, 158, 11, 0.12)` |
| `danger` | `--gb-danger: #ef4444` | `--gb-danger-border: rgba(239, 68, 68, 0.45)` | `--gb-danger-bg: rgba(239, 68, 68, 0.1)` |

### Syntax colors

Code blocks highlighted by gpu-lexer use docstream's `--docs-tok-*` tokens, so a theme that recolors docstream's code recolors the editor's too. The defaults use `light-dark()`, so they follow the host's `color-scheme`. Set `color-scheme: dark` on your dark theme.

| Token | Light default | Dark default |
| --- | --- | --- |
| `--docs-tok-comment` | `#6E6E7A` (italic) | `#8A8A98` |
| `--docs-tok-string` | `#23803A` | `#A5D6A7` |
| `--docs-tok-number` | `#C2410C` | `#F78C6C` |
| `--docs-tok-keyword` | `#8839C4` | `#C792EA` |
| `--docs-tok-type` | `#A15C00` | `#FFCB6B` |
| `--docs-tok-function` | `#2F5BD3` | `#82AAFF` |
| `--docs-tok-constant` | `#C8283F` | `#F07178` |
| `--docs-tok-operator` | `#0B7285` | `#89DDFF` |

## Recipes

{% tabs %}
{% tab title="Whole app" %}
```css title="theme.css"
:root {
  --card: #ffffff;
  --background: #ffffff;
  --foreground: #16161d;
  --border: #e4e4ea;
  --muted: #f4f4f6;
  --muted-foreground: #6e6e7a;
  --accent: #f0f0f4;
  --accent-foreground: #16161d;
  --primary: #5b5bd6;
  --popover: #ffffff;
  --popover-foreground: #16161d;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --card: #16161b;
  --background: #0e0e12;
  --foreground: #ececf1;
  --border: #2a2a34;
  --muted: #1b1b22;
  --muted-foreground: #9a9aa8;
  --accent: #22222b;
  --accent-foreground: #ececf1;
  --primary: #8b8bf0;
  --popover: #16161b;
  --popover-foreground: #ececf1;
}
```
{% endtab %}

{% tab title="One editor" %}
```css title="editor-theme.css"
/* Host tokens on a wrapper: the .gb tokens inside resolve against it. */
.brand-editor {
  --card: #fbfaff;
  --border: #ddd6fe;
  --muted: #f3f0ff;
  --primary: #7c3aed;
}
```

```tsx lineNumbers="false"
<div className="brand-editor"><GitbookEditor markdown={md} onChange={setMd} /></div>
```
{% endtab %}

{% tab title="Editor tokens" %}
```css title="editor-tokens.css"
/* Editor tokens are declared on .gb, so set them there. */
.gb.square {
  --gb-radius: 4px;
  --gb-code-bg: #f6f8fa;
  --gb-info: #0f766e;
  --gb-info-border: rgba(15, 118, 110, 0.45);
  --gb-info-bg: rgba(15, 118, 110, 0.08);
}
```

```tsx lineNumbers="false"
<GitbookEditor className="square" markdown={md} onChange={setMd} />
```
{% endtab %}

{% tab title="Layout" %}
```css title="editor-layout.css"
/* .gb is a centred 860px page with 120px of scroll room below the last block.
   Inside a pane, let it fill the space instead. */
.gb.in-pane {
  max-width: none;
  margin: 0;
  padding: 8px 16px 24px;
  border-bottom: 0;
}
```
{% endtab %}
{% endtabs %}

## Classes

Every element the editor draws has a stable `gb-*` class. These are the useful hooks:

| Class | Element |
| --- | --- |
| `gb` | The wrapper (`GitbookEditor`'s root; your `className` is added to it). Holds the tokens. |
| `gb-toolbar`, `gb-tool`, `gb-tool-active`, `gb-toolbar-hint` | The formatting toolbar, its buttons, the pressed state, the "Type / for blocks" hint. |
| `gb-content` (and `.gb .ProseMirror`) | The document area. |
| `gb-hint`, `gb-hint-info` / `-success` / `-warning` / `-danger` | Hint blocks. |
| `gb-tabs`, `gb-tabs-header`, `gb-tabs-tab`, `gb-tabs-tab-active`, `gb-tabs-section` | Tab sets (and titled sections). |
| `gb-stepper`, `gb-step`, `gb-step-badge`, `gb-step-title` | Steppers. |
| `gb-expandable`, `gb-columns`, `gb-column`, `gb-content-ref`, `gb-embed`, `gb-figure`, `gb-math`, `gb-updates`, `gb-update`, `gb-openapi` | The other GitBook blocks. |
| `gb-code`, `gb-code-header`, `gb-code-title`, `gb-code-lang`, `gb-code-mermaid`, `gb-code-live` | Code blocks, Mermaid and live fences. |
| `gb-command` | `{% command %}` boxes. |
| `gb-demo-block`, `gb-demo-src`, `gb-demo-title`, `gb-demo-files`, `gb-demo-grip` | Demo blocks, their header inputs, file editor and drag grip. |
| `gb-source-ref-block`, `gb-source-file-editor` | Source references and the file editor. |
| `gb-ref`, `gb-ref-mention`, `gb-ref-tag`, `gb-ref-codebase`, `gb-cite` | Chips and citation markers. |
| `gb-attachment`, `gb-attachment-card`, `gb-attachment-viewer` | Attachment chips, their hover card, the full-screen viewer. |
| `slash-menu`, `slash-item`, `slash-item-active`, `slash-group` | The `/` and reference menus (rendered in `document.body`). |
| `gb-react-demo-editor` | `ReactDemoEditor`'s root. |

{% hint style="info" %}
**The parity contract:** each `.gb-*` block mirrors its read-only twin in `@brett_lamy/docstream/styles.css` (`.docs-*`), with the same radii, spacing, palette and type scale. Change a token and both follow. For docstream's side of the contract, see [docstream's theming page](https://blamy.github.io/docstream/#/reference/theming).
{% endhint %}
