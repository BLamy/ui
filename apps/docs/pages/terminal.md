# Terminal

A real terminal emulator: [wterm](https://github.com/vercel-labs/wterm), which renders to the DOM, so text can be selected, found with ⌘F and read by a screen reader. It wears the theme in light and dark and fills its container, refitting as the container resizes. Connect it to something with a PTY, or give it a function that takes a whole line and it brings the line editing itself.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/terminal.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Terminal } from '@/components/ui/terminal'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Terminal } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="terminal/commands" %}

Give it a height, or a parent with one. It's as big as its parent, with no border or corners of its own.

## Whole lines

Most things you'd put behind a terminal in a browser take a whole command line, not keystrokes: a function, a request, a runtime in a Worker. `onCommand` gets each line, and an `io` to answer with.

```tsx
<Terminal
  prompt="$ "
  onCommand={async (line, io) => {
    const response = await fetch(`/run?line=${encodeURIComponent(line)}`, { signal: io.signal });
    io.write(await response.text());
  }}
  complete={({ word }) => commands.filter((name) => name.startsWith(word))}
/>
```

| `io` | |
| --- | --- |
| `write(data)` | Prints. `\n` becomes a line break, which a PTY would do and there's no PTY. Escape sequences pass through. |
| `signal` | Aborted by Ctrl-C. If the command takes no notice, a second Ctrl-C stops waiting for it. |
| `onInput(listener)` | Keys typed while it runs. Keys nobody is listening for wait for a listener, or for the next prompt, as they do in a terminal's buffer. |
| `clear()` | Clears the screen and scrollback. |
| `cols`, `rows` | The grid's size now. |

At the prompt you get what a shell's readline gives you: the arrow keys, Home and End, a word at a time with Alt or Ctrl and the arrows, Backspace and Delete, ↑ and ↓ through history, Ctrl-A, E, U, K, W, Y, L and D, Ctrl-C, and Tab if you give it `complete`. It moves by what's seen as a character, so an emoji goes in one press, and a line that wraps stays right as it's edited, which is most lines in a narrow window. A block of lines pasted in runs a line at a time.

This is `lib/terminal-line`. wterm has an adapter for this (`@wterm/just-bash`), but it can only drive the virtual shell it creates itself, not your function. It's plain functions (`applyKey`, `renderLine`, `readKeys`, `applyCompletion`) and `createTerminalShell`, which ties them together.

## Keeping a session

{% demo src="terminal/shell" %}

A terminal in a pane that moves or unmounts takes its screen with it, so keep the session outside. `createTerminalShell` has no React in it. Give it to `shell`, and a new Terminal shows the output so far and the line being typed, while a command that's still running carries on and prints into whichever terminal is showing it. It keeps the last 1,000,000 characters to do that (`maxTranscript`).

## With a PTY

Without `onCommand`, it's bytes both ways. `onData` gets what's typed, and whatever comes back goes to `write`.

```tsx
const terminal = useRef<TerminalHandle>(null);

<Terminal ref={terminal} onData={(keys) => pty.write(keys)} onResize={(cols, rows) => pty.resize(cols, rows)} />
pty.onData((data) => terminal.current?.write(data));
```

With none of these it echoes what's typed, which is wterm's default. With `readOnly` it shows what's written and hides the cursor.

## Output and theming

{% demo src="terminal/output" %}

Foreground, background, cursor and selection come from `--foreground`, `--background` and `--primary`, and the sixteen ANSI colors from `--destructive`, `--success`, `--warning` and `--link`, darkened on a light surface where they'd be too pale to read as text. There's no magenta or cyan in a palette, so those are mixes. Dark and light follow the theme, including when it changes with text on screen. It's all wterm's `--term-*` custom properties on the element, so you can set your own with a class.

The stylesheet comes in through `@brett_lamy/ui/styles.css`, in a layer under every utility. That's how `className` wins without `!important`. Don't import `@wterm/dom/css` as well: unlayered, it would beat all of it.

## Resizing and the core

A terminal core is what keeps the grid and reads escape sequences. There are two, and they differ in what happens as a terminal gets narrower.

| `core` | Narrowing | Cost |
| --- | --- | --- |
| `'ghostty'` (default) | Lines wrap again, and wrap back as it widens | A 600 KB WebAssembly file, fetched from your site the first time a terminal shows. Vite handles it; with another bundler check that `@wterm/ghostty` finds it, or pass your own core |
| `'builtin'` | What doesn't fit is cut off for good | None: it's embedded in the JavaScript |

If Ghostty's core can't be loaded, the terminal uses the built-in one. Nothing shows until it has decided, which on a cold load is the time to fetch the file. Pass a core of your own (`GhosttyCore.load({ wasmPath, scrollbackLimit })`) to set where it comes from; that one stays yours to dispose of.

## Keyboard

Keys go to the terminal while it has focus, Tab included, because Tab means something in a shell. Press Escape, then Tab or Shift+Tab, to move focus out. wterm takes focus when it starts wherever the page's focus is, so Terminal hands it straight back unless you set `autoFocus`.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `onCommand` | — | `(line, io) => void \| Promise<void>`. Turns on the prompt and the line editor. |
| `prompt` | `'$ '` | The prompt, on one row, as a string or a function. It may carry colors. |
| `complete` | — | `({ word, line, cursor }) => string[]`: what Tab offers, each a whole replacement for the word. Folders end in `/`. |
| `history` | — | Lines the up arrow starts with, oldest first. |
| `greeting` | — | Printed before the first prompt. |
| `onEof` | — | Ctrl-D on an empty line. |
| `shell` | — | A `createTerminalShell()` you keep yourself, instead of the props above. |
| `onData` | — | What the terminal sends: keys, and its replies to programs' queries. |
| `readOnly` | `false` | Shows output and ignores what's typed. |
| `autoFocus` | `false` | Takes the keyboard when ready. |
| `size` | `'md'` | `'sm'` (12px) or `'md'` (13px). |
| `core` | `'ghostty'` | See above. |
| `onReady` | — | `(instance) => …` once it's up, fitted to its container. |
| `onResize` | — | `(cols, rows) => …` |
| `onTitle`, `onBell`, `onClipboardWrite`, `onWorkingDirectory`, `onShellIntegration` | — | What programs ask for. wterm only passes these on: a clipboard write, say, is a request you can refuse. |
| `cursorBlink`, `renderingPaused`, `announceOutput`, `webmcp` | — | Passed to [wterm](https://wterm.dev). |

`className` and `style` go on the root last, and it takes any other `div` prop. `terminalVariants` is the recipe. `aria-label` names the input.

The ref is a `TerminalHandle`:

| | |
| --- | --- |
| `write(data)` | Prints. With a prompt, above it, leaving the line being typed alone. |
| `clear()` | Clears the screen and scrollback. |
| `focus()` | Takes the keyboard. |
| `fit()` | Fits the grid to the container now. |
| `resize(cols, rows)` | Sets the grid's size, until the container's next change of size. |
| `cols`, `rows` | The grid's size. |
| `instance` | The `WTerm`: `search`, `readText`, `selectAll`, `scrollToPrompt`… |
| `shell` | The shell behind the prompt, if there is one. |

The block [VS Code](https://blamy.github.io/ui/#/blocks/vscode) puts this on a runtime, and shows what line editing looks like from outside: its terminal panel only ever sees a raw stream.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `terminalVariants`

Defined in `@/components/ui/terminal`. Base classes:

```text
[ 'bl-scroll size-full min-h-0 min-w-0 rounded-none p-2 font-mono shadow-none', '[--term-bg:var(--background)] [--term-fg:var(--foreground)] [--term-cursor:var(--primary)]', '[--term-selection-bg:color-mix(in_oklab,var(--primary)_30%,transparent)] selection:bg-primary/30', '[--term-search-match:color-mix(in_oklab,var(--term-yellow)_30%,transparent)] [--term-search-active:color-mix(in_oklab,var(--term-yellow)_55%,transparent)] [--term-search-border:var(--term-yellow)]', '[--term-red:var(--destructive)] [--term-green:var(--success,oklch(0.723_0.191_149.6))] [--term-yellow:var(--warning,oklch(0.769_0.165_70.1))] [--term-blue:var(--link,var(--primary))]', '[--term-magenta:color-mix(in_oklch,var(--term-red),var(--term-blue))] [--term-cyan:color-mix(in_oklch,var(--term-blue),var(--term-green))]', '[--term-color-0:var(--foreground)] [--term-color-7:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-8:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-15:color-mix(in_oklab,var(--foreground)_70%,var(--background))]', '[--term-color-1:color-mix(in_oklab,var(--term-red)_85%,black)] [--term-color-2:color-mix(in_oklab,var(--term-green)_65%,black)] [--term-color-3:color-mix(in_oklab,var(--term-yellow)_55%,black)]', '[--term-color-4:color-mix(in_oklab,var(--term-blue)_85%,black)] [--term-color-5:color-mix(in_oklab,var(--term-magenta)_80%,black)] [--term-color-6:color-mix(in_oklab,var(--term-cyan)_65%,black)]', '[--term-color-9:var(--term-red)] [--term-color-10:color-mix(in_oklab,var(--term-green)_80%,black)] [--term-color-11:color-mix(in_oklab,var(--term-yellow)_70%,black)]', '[--term-color-12:var(--term-blue)] [--term-color-13:var(--term-magenta)] [--term-color-14:color-mix(in_oklab,var(--term-cyan)_80%,black)]', 'dark:[--term-color-0:color-mix(in_oklab,var(--foreground)_18%,var(--background))] dark:[--term-color-7:color-mix(in_oklab,var(--foreground)_80%,var(--background))] dark:[--term-color-15:var(--foreground)]', 'dark:[--term-color-1:var(--term-red)] dark:[--term-color-2:var(--term-green)] dark:[--term-color-3:var(--term-yellow)] dark:[--term-color-4:var(--term-blue)] dark:[--term-color-5:var(--term-magenta)] dark:[--term-color-6:var(--term-cyan)]', 'dark:[--term-color-9:color-mix(in_oklab,var(--term-red)_75%,white)] dark:[--term-color-10:color-mix(in_oklab,var(--term-green)_75%,white)] dark:[--term-color-11:color-mix(in_oklab,var(--term-yellow)_75%,white)]', 'dark:[--term-color-12:color-mix(in_oklab,var(--term-blue)_75%,white)] dark:[--term-color-13:color-mix(in_oklab,var(--term-magenta)_75%,white)] dark:[--term-color-14:color-mix(in_oklab,var(--term-cyan)_75%,white)]', ]
```

**`size`** — default `md`

| Value | Adds |
| --- | --- |
| `sm` | `[--term-font-size:12px] [--term-row-height:16px]` |
| `md` (default) | `[--term-font-size:13px] [--term-row-height:18px]` |
