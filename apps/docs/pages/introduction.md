# BL UI

BL UI brings Cocoa Touch-style composition to a typed React package. Containers own adaptive behavior; applications own state and data. The same component trees work in full pages, resizable panes, and compact device layouts.

## What it is

BL UI is a generic component library in the shadcn style, with an iOS accent, plus a set of **blocks** that show how the parts compose. The parts are React Aria Components styled with Tailwind v4 and [cva](https://blamy.github.io/ui/#/styling); colors, radius, type and shadows come from CSS variables you own ([Theming](https://blamy.github.io/ui/#/theming)).

| Layer | What is in it |
| --- | --- |
| Library | Primitives (Button, Dialog, Select, Tabs, …), iOS containers (NavigationStack, SplitView, TabView, Credenza, SideDrawer, Sidebar, List, CommandMenu, Toast, Morph), Icon, motion, the theme, the Composer, PencilKit, MarkdownEditor, MessageScroller and more |
| Blocks | Whole apps composed from the library, with the product-specific parts (a chat shell, a workbench, a tile map, sample data) kept in the block: Mail, Notes, Reminders, Discord, GitHub, T3 Code, … |

Take it one of two ways, from the same source: **copy the source you need** with the shadcn registry (recommended, and the tree-shaking mechanism: you own only what you add), or **install everything** as `@brett_lamy/ui`. [Installation](https://blamy.github.io/ui/#/installation) has both, and [How the registry works](https://blamy.github.io/ui/#/registry) explains the first.

The full Contacts composition is interactive here:

{% demo src="introduction/contacts" %}

## A first app

Twenty-odd lines of composition: a `TabView` with a bar, a `NavigationStack` inside the first tab, inset `List`s, and a `Credenza` tray. The app owns only its data; every container brings its own gestures and transitions.

{% demo src="introduction/first-app" %}

## Core vocabulary

| UIKit idea | BL UI component |
| --- | --- |
| Navigation controller | `NavigationStack` — controlled push/pop and edge-swipe back |
| Split view controller | `SplitView` — adaptive sidebar, master, and detail |
| Tab bar controller | `TabBar` — composable tab navigation |
| Table view | `List`, `List.Section`, `List.Row` |
| Section index titles | `IndexBar` — A-Z fallback or application-defined keyed stops |
| Sheets and trays | `Credenza` |
| Inspector column | `SideDrawer` |
| Sidebar | `Sidebar` — docked, rail, float, or overlay navigation |
| Canvas view | `PencilCanvas` |

## How the docs are organized

The sidebar groups pages by what a part does, not by how big it is. **Foundations** covers theming, styling, variants, motion and icons. Then come the parts: **Buttons and toggles**, **Forms and inputs**, **Menus and overlays**, **Feedback and status**, **Lists and content**, **Navigation and layout**, **Motion components**, **Chat**, and **Editors and workbench**. **Hooks** documents every hook the library exports.

The shells that belong to one product (the Discord-style `ChatShell`, the T3-style `WorkbenchShell`) live in [blocks](https://blamy.github.io/ui/#/blocks). Every one is built from the parts documented here, so a shell that does not fit can be recomposed from them.

## Where to go next

- [Installation](https://blamy.github.io/ui/#/installation): the registry (copy source) or npm, for Vite and Next.js.
- [Styling and variants](https://blamy.github.io/ui/#/styling): every component is a cva recipe you can reuse and extend.
- [Theming](https://blamy.github.io/ui/#/theming): variables, tokens and scopes.
- [Blocks](https://blamy.github.io/ui/#/blocks): whole apps to read, run and copy.
- [Working with LLMs](https://blamy.github.io/ui/#/working-with-llms): prompts for a coding agent.

## Principles

1. **Composition over configuration** — placement determines container behavior.
2. **Controlled components** — state in, events out.
3. **Container-aware adaptation** — shells measure themselves, not the viewport.
4. **Interaction quality** — gestures, keyboard access, and responsive transitions are part of the component API.
