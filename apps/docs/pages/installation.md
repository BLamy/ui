# Installation

BL UI is built on [UI SDK](https://ui-sdk.dev) (keyboard, focus, selection, popups, ARIA) and Tailwind CSS v4, and needs React 19. It uses our fork of UI SDK under upstream's package names (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk)). You can take it two ways from one source of truth:

- **shadcn registry (recommended).** `npx shadcn@latest add …` copies the source of the parts you pick into your project. There is no runtime dependency on `@brett_lamy/ui`, only what each part imports (`@ui-sdk/core`, `@ui-sdk/react`, `framer-motion`, …). You own the files, so you can edit variants and defaults, and you ship exactly what you added.
- **npm package.** `npm install @brett_lamy/ui` gives you everything, packaged together. It is generated from the same sources: ESM, one output module per source module so bundlers tree-shake, an entry per module at the registry's path (`@brett_lamy/ui/dialog` for `@/components/ui/dialog`), and `'use client'` on component modules for Next.js.

| | Registry | npm |
| --- | --- | --- |
| You get | Source files in `components/ui/` and `lib/` | `@brett_lamy/ui` in `node_modules` |
| Change a default or add a variant | Edit your copy | Wrap the component |
| Bundle | Only what you add | Whatever you import, tree-shaken |
| Blocks (whole apps) | Yes, `components/blocks/<name>/` | No, registry only |
| Updates | Re-run `add` and review the diff | `npm update` |

See [Optimization](https://blamy.github.io/ui/#/optimization) for how to choose and how to keep bundles small, and [How the registry works](https://blamy.github.io/ui/#/registry) for what an item is.

## Registry

{% tabs title="Framework" sync="framework" %}
{% tab title="Vite" %}
{% stepper %}
{% step %}
### Start from a shadcn app

New project: scaffold a Vite + React + Tailwind v4 app with shadcn. Pick any base and preset (look) when it asks: BL UI's parts are UI SDK parts and don't depend on shadcn's base.

{% command %}npx shadcn@latest create --name my-app --template vite{% endcommand %}

This writes `components.json`, the `@/` import alias, `lib/utils.ts` and the theme CSS.

Existing app: it needs Tailwind CSS v4 and an `@/` alias. Skip the rest of this step if you have them.

{% command %}npm install tailwindcss @tailwindcss/vite{% endcommand %}

```ts
// vite.config.ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

```css
/* src/index.css */
@layer ui-sdk;
@import "tailwindcss";
```

Add the alias to `tsconfig.json` (and `tsconfig.app.json` if you have one), then run shadcn's `init`. If you already use shadcn with any base (Radix, Base UI, React Aria) you can keep it: BL UI does not depend on your base.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

{% command %}npx shadcn@latest init{% endcommand %}
{% endstep %}

{% step %}
### Add UI SDK

BL UI's parts import [UI SDK](https://ui-sdk.dev) as `@ui-sdk/core` and `@ui-sdk/react`. Install our fork of it under those names, both at the same version:

{% command %}npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1{% endcommand %}

UI SDK adds a little CSS at runtime (hidden parts, the popup reset, a sheet's backdrop) in a cascade layer named `ui-sdk`. Declare that layer first, at the very top of your global CSS (`@layer ui-sdk;` above `@import "tailwindcss"`, as in the snippet above), so your own styles and Tailwind's utilities always win over it. See [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6) for the details.
{% endstep %}

{% step %}
### Add BL UI

`bl-ui` is the base item every other item depends on, so adding any part brings it along. It writes BL UI's tokens into your CSS `@theme inline` (extra colors such as `text-tertiary-foreground`, `bg-bar`, `text-success`, the radius, text-size, shadow and size scales, the spring motion tokens), the framework CSS (keyframes, scrollbars, a `box-sizing` reset scoped to `[data-slot]`), and redefines the `dark` variant so the element that carries `.dark` restyles itself. It installs no package and leaves your palette alone.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}
{% endstep %}

{% step %}
### Add the iOS theme (optional)

`bl-theme` sets your shadcn variables (light and dark) to the iOS palette and adds the `workbench`, `terminal`, `sheet` and `glass` [theme scopes](https://blamy.github.io/ui/#/theming). It overwrites the palette variables it sets. Skip it to keep your own look.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}
{% endstep %}

{% step %}
### Add parts and blocks

Each part's page has an **Installation** section with its command. Parts land in `components/ui/<name>.tsx` and `lib/<name>.ts`; blocks, which are whole apps, in `components/blocks/<name>/`.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-reminders.json{% endcommand %}
{% endstep %}

{% step %}
### Use them

```tsx
// src/App.tsx
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSend,
} from '@/components/ui/composer/composer'
import AppleReminders from '@/components/blocks/apple-reminders/page'

export default function App() {
  return (
    <main className="grid h-dvh grid-rows-[1fr_auto]">
      <AppleReminders />
      <Composer onSubmit={(markdown) => console.log(markdown)}>
        <ComposerCard>
          <ComposerInput placeholder="Ask anything" />
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </main>
  )
}
```

{% command %}npm run dev{% endcommand %}

Some parts wrap libraries that ship CommonJS-only dependencies. If Vite reports a missing export from `@brett_lamy/docstream` or `@brett_lamy/docstream-editor`, add them to `optimizeDeps.include` (see [Optimization](https://blamy.github.io/ui/#/optimization)).
{% endstep %}
{% endstepper %}
{% endtab %}

{% tab title="Next.js" %}
{% stepper %}
{% step %}
### Start from a shadcn app

New project: scaffold a Next.js app with shadcn (any base). It sets up Tailwind CSS v4 through `@tailwindcss/postcss`, the `@/` alias and `components.json`; check that the latter has `"rsc": true` (see the next steps).

{% command %}npx shadcn@latest create --name my-app --template next{% endcommand %}

Existing app: it needs Tailwind CSS v4 and the `@/*` alias (create-next-app's default). For Tailwind v4 in Next, install the PostCSS plugin and import Tailwind in your global CSS:

{% command %}npm install tailwindcss @tailwindcss/postcss postcss{% endcommand %}

```js
// postcss.config.mjs
const config = { plugins: { '@tailwindcss/postcss': {} } }
export default config
```

```css
/* app/globals.css */
@layer ui-sdk;
@import "tailwindcss";
```

Then run shadcn's `init`, which writes `components.json` and `lib/utils.ts`:

{% command %}npx shadcn@latest init{% endcommand %}
{% endstep %}

{% step %}
### Add UI SDK

The same two aliased packages and the same `@layer ui-sdk;` line at the top of `app/globals.css` as on Vite:

{% command %}npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1{% endcommand %}
{% endstep %}

{% step %}
### Add BL UI

The same base item as on Vite. It only edits your CSS (tokens and framework CSS), so it works with the App Router unchanged.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}
{% endstep %}

{% step %}
### Add the iOS theme (optional)

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}
{% endstep %}

{% step %}
### Add parts and blocks

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json{% endcommand %}

The copied modules that use hooks, UI SDK parts or motion start with `'use client'`. Keep `"rsc": true` in `components.json` for a Next app: the shadcn CLI leaves the directives in with it and strips them with `"rsc": false`.
{% endstep %}

{% step %}
### Use them

A server component can render a BL UI part, but a function prop such as `onClick` has to come from a client component. Put the interactive part behind your own `'use client'` file:

```tsx
// components/todo-list.tsx
'use client'
import { List, ListRow, ListSection } from '@/components/ui/list'

export function TodoList() {
  return (
    <List variant="inset">
      <ListSection title="Today">
        <ListRow title="Ship the docs" onClick={() => {}} />
      </ListSection>
    </List>
  )
}
```

```tsx
// app/page.tsx (a server component)
import { TodoList } from '@/components/todo-list'

export default function Page() {
  return <TodoList />
}
```

Browser-only parts (the Composer's editor, maps, session replay) can also be loaded with `next/dynamic` and `ssr: false`; see [Optimization](https://blamy.github.io/ui/#/optimization).
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}

### What gets copied where

| Item type | Lands in | Example |
| --- | --- | --- |
| `registry:style` | your CSS, no files | `bl-ui` |
| `registry:theme` | your CSS variables, no files | `bl-theme` |
| `registry:ui` | `components/ui/<name>.tsx`, or a folder `components/ui/<name>/` for a part made of several files | `button`, `list`, `composer` |
| `registry:lib` | `lib/<name>.ts` | `icon`, `motion`, `theme`, `utils` |
| `registry:block` | `components/blocks/<name>/` | `apple-mail`, `discord-clone` |

Each item declares the items it imports, so `npx shadcn@latest add …/list.json` also copies `button`, `icon`, `motion`, `utils` and the rest of what `list` needs, and installs the npm packages those files import (`framer-motion`, `class-variance-authority`, …), and only those. The two UI SDK packages are the exception: install them yourself under their aliases, as in the steps above, so the copied files' `@ui-sdk/core` and `@ui-sdk/react` imports resolve to our fork. The index is [`registry.json`](https://blamy.github.io/ui/r/registry.json).

> **BL UI replaces `components/ui/button.tsx` and `lib/utils.ts`.** Dependencies are declared on BL UI's own items, so shadcn's stock `button` is never pulled in, and adding a part that uses Button writes BL UI's `button.tsx` over yours. The same goes for `lib/utils.ts`. BL UI's `cn` is a superset of shadcn's (the same `clsx` plus `tailwind-merge`, with BL UI's tokens registered), so code that calls `cn` keeps working, but your `Button` variants and any edits to these two files are replaced. Commit first, and review the diff after `add`. The CLI asks before overwriting; `-o` answers yes.

### Aliases

Source files import by alias: `@/components/ui/<name>` and `@/lib/<name>`, which are shadcn's defaults. The CLI rewrites them to the aliases in your `components.json`, so an app that uses `~/components/ui` and `~/lib` works after you set:

```json
{
  "aliases": {
    "components": "~/components",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "utils": "~/lib/utils"
  }
}
```

Set these before the first `add`, and make sure your bundler and `tsconfig` resolve the same prefix.

### Updating later

Nothing pins you to a version. To pick up a change, re-run the item's `add` with `-o` and read the diff (`git diff`) to bring your own edits back:

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json -o{% endcommand %}

The live docs pages always show the current source in each demo's code panel.

### Adding blocks

A block is a whole app or screen composed from library parts. Adding one copies its own files into `components/blocks/<name>/` and only the library parts it imports. Render the default export of `page.tsx` inside a sized container. See [Blocks](https://blamy.github.io/ui/#/blocks) and, for how they are put together, [Anatomy of a block](https://blamy.github.io/ui/#/blocks).

## npm package

{% tabs title="Framework" sync="framework" %}
{% tab title="Vite" %}
{% stepper %}
{% step %}
### Install

BL UI needs React 19. `@brett_lamy/ui` depends on our fork of UI SDK under upstream's names, so the install brings `@ui-sdk/core` and `@ui-sdk/react` with it. Tailwind is optional here: the package ships a precompiled stylesheet for its own classes. You only need Tailwind if you also write Tailwind classes in your app.

{% command %}npm install @brett_lamy/ui{% endcommand %}
{% endstep %}

{% step %}
### Import the styles

Import the stylesheet once at your app's entry, before your own CSS: it declares the cascade layers, `ui-sdk` first, so UI SDK's runtime rules stay below everything else. (With a Tailwind build of your own, also put `@layer ui-sdk;` at the top of your global CSS.) Add the theme if you want the iOS palette; without it, define shadcn's CSS variables (`--background`, `--primary`, …) yourself or from a shadcn preset.

```tsx
// src/main.tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
```
{% endstep %}

{% step %}
### Use it

```tsx
import { BLProvider } from '@brett_lamy/ui/lib/theme'
import { NavigationStack } from '@brett_lamy/ui/navigation-stack'
import { SplitView } from '@brett_lamy/ui/split-view'
```

Every module has its own entry, at the registry's path under the package name: `@/components/ui/split-view` is `@brett_lamy/ui/split-view`, `@/lib/theme` is `@brett_lamy/ui/lib/theme`, and each component page shows its import. The components, their parts and the documented hooks are also on the package root, `import { BLProvider, NavigationStack, SplitView } from '@brett_lamy/ui'`. Both tree-shake the same in a production build; a module entry also keeps the dev server and your editor from loading the whole index to resolve one name, and switching to or from the registry changes only the prefix.

Vite pre-bundles the docstream packages on first use. If it reports a missing export from `@brett_lamy/docstream` or `@brett_lamy/docstream-editor`, add them to `optimizeDeps.include` ([Optimization](https://blamy.github.io/ui/#/optimization)).
{% endstep %}
{% endstepper %}
{% endtab %}

{% tab title="Next.js" %}
{% stepper %}
{% step %}
### Install

{% command %}npm install @brett_lamy/ui{% endcommand %}
{% endstep %}

{% step %}
### Import the styles in the root layout

```tsx
// app/layout.tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/theme.css' // optional: the iOS palette

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

If you also use Tailwind classes in your own code, set up Tailwind v4 with `@tailwindcss/postcss` as in the registry steps above.
{% endstep %}

{% step %}
### Use it

The package is compiled ESM and its component modules carry `'use client'`, so a server component can import and render them. Function props (`onClick`, `onValueChange`) still have to come from a client component.

```tsx
// app/page.tsx
import { Button } from '@brett_lamy/ui/button'

export default function Page() {
  return <Button>Continue</Button>
}
```

Module entries (`@brett_lamy/ui/button`) need no configuration. If you import from the package root instead, `experimental.optimizePackageImports: ['@brett_lamy/ui']` in `next.config` keeps those imports cheap. `transpilePackages` is not needed: the package is already compiled.
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}

The npm package contains the library only (every component and lib, `styles.css`, `theme.css`). Blocks are registry-only. 6.0 is a breaking release: the components moved from react-aria-components to UI SDK, and their props follow UI SDK's API. See [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## What the registry installs

| Item | What it is |
| --- | --- |
| `bl-ui` | Tokens and framework CSS written into your CSS. Every other item depends on it. Installs no package. |
| `bl-theme` | Optional: the iOS palette on your shadcn variables, plus the `workbench`, `terminal`, `sheet` and `glass` theme scopes |
| `button`, `dialog`, `select`, `tabs`, … | shadcn-style primitives, one item each, in `components/ui/<name>.tsx` |
| `list`, `split-view`, `navigation-stack`, `composer`, … | Containers and larger parts, grouped with the modules that belong together |
| `icon`, `motion`, `theme`, `utils`, … | Libraries in `lib/<name>.ts` |
| `github-clone`, `apple-mail`, … | A whole app in `components/blocks/<name>/`, see [Blocks](https://blamy.github.io/ui/#/blocks) |

## Provider

`BLProvider` gives an iOS surface its appearance (`light` / `dark`), tint, font and safe area, and hosts overlays. Shells open their own theme scopes. See [Theming](https://blamy.github.io/ui/#/theming).

```tsx
<BLProvider tint="#0A84FF">
  <NavigationStack pages={pages} onPagesChange={setPages}>
    <NavigationStackPage value="inbox">…</NavigationStackPage>
  </NavigationStack>
</BLProvider>
```

## Requirements

- React and React DOM 19 (and `@types/react` 19.2.10 or newer with TypeScript)
- `@ui-sdk/core` and `@ui-sdk/react`, as the aliases `npm:@brett_lamy/ui-sdk-core` and `npm:@brett_lamy/ui-sdk-react` (the npm package brings them; a registry install adds them by hand)
- `@layer ui-sdk;` declared before your other CSS when you have your own Tailwind build
- Tailwind CSS v4 (for the registry path, and for any Tailwind classes of your own)
- shadcn's CSS variables, from your shadcn theme or the bl-theme
- A bundler that resolves ESM package exports and CSS imports (Vite, Next.js, React Router, …)
- Browser APIs such as ResizeObserver for container-aware shells

## Live check

{% demo src="installation/controls" %}
