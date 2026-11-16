# BL UI

BL UI brings Cocoa Touch-style composition to a typed React package. Containers own adaptive behavior; applications own state and data. The same component trees work in full pages, resizable panes, and compact device layouts.

## What it is

BL UI is a generic component library in the shadcn style, with an iOS accent, plus a set of **blocks** that show how the parts compose. The parts are [UI SDK](https://ui-sdk.dev) parts styled with Tailwind v4 and [cva](https://blamy.github.io/ui/#/styling): UI SDK owns the behavior (keyboard, focus, selection, dismissal, popups, drag and drop, ARIA), BL UI owns the look, the tokens and the iOS containers, which are primitives built from UI SDK's behaviors. Colors, radius, type and shadows come from CSS variables you own ([Theming](https://blamy.github.io/ui/#/theming)). BL UI needs React 19; [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk) explains the layers, and [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6) what changed from the react-aria-based 5.x.

| Layer | What is in it |
| --- | --- |
| Library | Primitives (Button, Dialog, Select, Tabs, …), iOS containers (NavigationStack, SplitView, Tabs, Dialog trays, AdaptivePane, Sidebar, List, CommandMenu, Toast, Morph), Icon, motion, the theme, the Composer, PencilKit, MarkdownView and MarkdownEditor, MessageScroller, Canvas and the diagrams (Diagram, StateDiagram, CloudflareDiagram) and more |
| Docstream | The GitBook-flavored Markdown and AI-stream renderer, with its docs sites, live demos, replays and Strudel player, and its Tiptap editor: part of `@brett_lamy/ui` (`@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream-editor`), behind MarkdownView, MarkdownEditor and the Composer, and documented on its own at [#/docstream](https://blamy.github.io/ui/#/docstream) |
| Blocks | Whole apps composed from the library, with the product-specific parts (a chat shell, a workbench, a tile map, sample data) kept in the block: Mail, Notes, Reminders, Discord, GitHub, T3 Code, Cloudflare Studio, … |

Take it one of two ways, from the same source: **copy the source you need** with the shadcn registry (recommended, and the tree-shaking mechanism: you own only what you add), or **install everything** as `@brett_lamy/ui`. [Installation](https://blamy.github.io/ui/#/installation) has both, and [How the registry works](https://blamy.github.io/ui/#/registry) explains the first. This site's [Libraries](https://blamy.github.io/ui/#/libraries) and [roadmap](https://blamy.github.io/ui/#/roadmap) show how `@brett_lamy/ui` will split into packages.

The full Contacts composition is interactive here:

{% demo src="introduction/contacts" %}

## A first app

Twenty-odd lines of composition: a `Tabs` bar, a `NavigationStack` inside the first tab, inset `List`s, and a `Dialog` that becomes a tray on a phone. The app owns only its data; every container brings its own gestures and transitions.

{% demo src="introduction/first-app" %}

## Core vocabulary

| UIKit idea | BL UI component |
| --- | --- |
| Navigation controller | `NavigationStack` — controlled push/pop and edge-swipe back |
| Split view controller | `SplitView` — adaptive sidebar, master, and detail |
| Tab bar controller | `Tabs` with `variant="bar"`: composable tab navigation |
| Table view | `List`, `ListSection`, `ListRow` |
| Section index titles | `IndexBar` — the A–Z rail (`indexBarAlphabetItems`) or application-defined keyed stops |
| Sheets and trays | `Dialog` (`variant="tray"`), `Sheet` |
| Inspector column | `AdaptivePane` |
| Sidebar | `Sidebar` — docked, rail or float, as a column or a drawer (`presentation`) |
| Canvas view | `PencilCanvas` |

## How the docs are organized

The sidebar groups pages by what a part does, not by how big it is. **Foundations** covers theming, styling, variants, motion and icons. Then come the parts: **Controls**, **Forms and fields**, **Menus and overlays**, **Feedback and status**, **Content**, **Lists, trees and tables**, **Navigation and layout**, **Canvas and diagrams**, **Motion components**, **Chat**, **Editors and workbench**, **Media**, and **Storage and security**. Within a section, pages are in alphabetical order. **Hooks** documents every hook the library exports, and **Behaviors** the UI SDK behaviors the containers are built from, for building parts of your own.

The shells that belong to one product (the Discord-style `ChatShell`, the T3-style `WorkbenchShell`) live in [blocks](https://blamy.github.io/ui/#/blocks). Every one is built from the parts documented here, so a shell that does not fit can be recomposed from them.

## Where to go next

- [Installation](https://blamy.github.io/ui/#/installation): the registry (copy source) or npm, for Vite and Next.js.
- [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6): from 5.x, or from `@brett_lamy/docstream` 2.0.1.
- [Styling and variants](https://blamy.github.io/ui/#/styling): every component is a cva recipe you can reuse and extend.
- [Theming](https://blamy.github.io/ui/#/theming): variables, tokens and scopes.
- [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk): how the kit is layered, and how to build a component the same way.
- [Blocks](https://blamy.github.io/ui/#/blocks): whole apps to read, run and copy.
- [Working with LLMs](https://blamy.github.io/ui/#/working-with-llms): prompts for a coding agent.

## Principles

1. **Composition over configuration** — placement determines container behavior.
2. **Controlled components** — state in, events out.
3. **Container-aware adaptation** — shells measure themselves, not the viewport.
4. **Interaction quality** — gestures, keyboard access, and responsive transitions are part of the component API.
