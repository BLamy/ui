# Installation

BL UI is one typed ESM package, [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui), built on [React Aria Components](https://react-aria.adobe.com/) and Tailwind CSS v4. It is also a [shadcn registry](https://ui.shadcn.com/docs/registry), so the shadcn CLI can set up a project for it and add components and whole-app blocks.

{% tabs title="Get started" sync="setup" %}
{% tab title="New project" %}
Start from shadcn's React Aria base — the same foundation BL UI is built on — then add BL UI on top.

{% stepper %}
{% step %}
### Create the app

Scaffold a Vite + React + Tailwind v4 app with shadcn's React Aria components (`--base aria`). Pick another `--template` (`next`, `react-router`, `start`, `astro`) if you prefer — everything below works the same — and choose a preset (look) when it asks.

{% command %}npx shadcn@latest create --name my-app --template vite --base aria{% endcommand %}

This writes `components.json`, the `@/` import alias, `lib/utils.ts` and the theme CSS, and installs `react-aria-components`.
{% endstep %}

{% step %}
### Add BL UI

From the new project's folder, add the `bl-ui` base item. It installs `@brett_lamy/ui`, imports its stylesheet into your CSS and registers BL UI's few extra color utilities (`text-tertiary-foreground`, `bg-secondary-strong`, `bg-bar`, `text-success`, …) next to shadcn's. Your shadcn palette is left alone: BL UI's parts are styled with your theme's variables.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}
{% endstep %}

{% step %}
### Add the iOS theme (optional)

For the look on this site, add the `bl-theme`: it sets your shadcn variables (light and dark) to the iOS palette and adds the Workbench, terminal and chat [theme scopes](https://blamy.github.io/ui/#/theming). Skip it to keep your own palette.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}
{% endstep %}

{% step %}
### Add components and blocks

Each component page's **Installation** section has its command. Components land in `components/ui/<name>.tsx`; blocks — whole apps — in `components/blocks/<name>/`.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-reminders.json{% endcommand %}
{% endstep %}

{% step %}
### Use them

```tsx
// src/App.tsx
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSend,
} from '@/components/ui/composer'
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
{% endstep %}
{% endstepper %}
{% endtab %}

{% tab title="Existing project" %}
BL UI needs React 18 or 19 and Tailwind CSS v4. The shadcn CLI adds it to an existing app; if you'd rather not use shadcn, install the package directly (last step).

{% stepper %}
{% step %}
### Set up Tailwind and an import alias

Skip this if your app already has Tailwind v4 and an `@/` alias. For Vite:

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
@import "tailwindcss";
```

Add the same alias to `tsconfig.json` (and `tsconfig.app.json` if you have one):

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Next.js, React Router and other frameworks: follow shadcn's [installation guide](https://ui.shadcn.com/docs/installation) for your framework — it covers Tailwind and the alias.
{% endstep %}

{% step %}
### Initialise shadcn

Run `init` in the project root with the React Aria base. It writes `components.json`, adds `lib/utils.ts` (`cn`) and the theme CSS variables, and installs `react-aria-components`. If you already use shadcn with another base (Radix or Base UI), you can keep it — BL UI doesn't depend on your base — and skip to the next step.

{% command %}npx shadcn@latest init --base aria{% endcommand %}
{% endstep %}

{% step %}
### Add BL UI

The `bl-ui` base item installs `@brett_lamy/ui`, imports its stylesheet and registers BL UI's extra color utilities. Every other BL UI item depends on it, so adding any component brings it along. For the iOS look, also add the `bl-theme` (it overwrites your palette's variables — leave it out to keep yours).

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}

Then add what you need and import it from your alias:

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/split-view.json{% endcommand %}

```tsx
import {
  SplitView, SplitViewSidebar, SplitViewDetail,
} from '@/components/ui/split-view'
```
{% endstep %}

{% step %}
### Or: install the package without shadcn

Everything is exported from the package root. Import the stylesheet once at your app's entry — and the bl-theme if you want the iOS palette (without it, define shadcn's CSS variables yourself):

{% command %}npm install @brett_lamy/ui{% endcommand %}

```tsx
// src/main.tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
```

```tsx
import { BLProvider, NavigationStack, SplitView } from '@brett_lamy/ui'
```
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}

## What gets installed

| Item | Installs |
| --- | --- |
| `bl-ui` | `@brett_lamy/ui`, its stylesheet, and BL UI's extra color utilities (added automatically by every other item) |
| `bl-theme` | Optional: the iOS palette on your shadcn variables, plus the Workbench, terminal and chat theme scopes |
| `composer`, `split-view`, `list`, … | `components/ui/<name>.tsx`, a thin re-export — one per component page |
| `github-clone`, `apple-mail`, … | A whole app in `components/blocks/<name>/` — see [Blocks](https://blamy.github.io/ui/#/blocks) |

The index is [`registry.json`](https://blamy.github.io/ui/r/registry.json).

| Area | Contents |
| --- | --- |
| Core | Theme, lists, navigation, IndexBar, Credenza, SideDrawer, Sidebar, layout primitives |
| Chat | ChatShell, channel navigation, messages, thread previews, FloatingSheet, ArtifactChatContainer |
| Workbench | WorkbenchShell, Composer, MessageScroller, terminal, surfaces, MarkdownView |
| PencilKit | PencilKit-style drawing canvas and toolbar, and `PencilKitAnnotator` — the Composer's default image annotator |

## Provider

`BLProvider` gives an iOS surface its appearance (`light` / `dark`), tint, font and safe area, and hosts overlays. `WorkbenchShell` and `ChatShell` open their own theme scopes. See [Theming](https://blamy.github.io/ui/#/theming).

```tsx
<BLProvider tint="#0A84FF">
  <NavigationStack screens={screens} onPop={handlePop} />
</BLProvider>
```

## Requirements

- React and React DOM 18 or 19
- Tailwind CSS v4 (for shadcn items and the color utilities)
- shadcn's CSS variables — from your shadcn theme or the bl-theme
- A bundler that resolves ESM package exports and CSS imports (Vite, Next.js, React Router, …)
- Browser APIs such as ResizeObserver for container-aware shells

## Live check

{% demo src="installation/controls" %}
