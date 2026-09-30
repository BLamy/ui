# BL UI

BL UI brings Cocoa Touch-style composition to a typed React package. Containers own adaptive behavior; applications own state and data. The same component trees work in full pages, resizable panes, and compact device layouts.

## Package and demos

BL UI is one package, `@brett_lamy/ui`: every component, container and shell, and PencilKit drawing.

| Area | Runnable demo |
| --- | --- |
| Containers | Contacts: NavigationStack, SplitView, lists, A-Z/custom IndexBar, tabs, Credenza, SideDrawer |
| Chat | Team chat: workspace rail, channel navigation, messages, composer, thread views |
| Workbench | IDE scaffold: threads, MessageScroller, terminal dock/sheet, surface panel, MarkdownView |
| PencilKit | Pressure-aware drawing, and the Composer's image annotator |

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

## Atomic design

The docs follow the same tiers as Storybook. **Atoms** and **molecules** are the smallest reusable pieces, **organisms** are self-contained regions such as a Sidebar or NavigationStack, and **templates** compose organisms into responsive shells. Every template is built from the organisms and molecules documented here, so a shell that does not fit can be recomposed from its parts.

## Principles

1. **Composition over configuration** — placement determines container behavior.
2. **Controlled components** — state in, events out.
3. **Container-aware adaptation** — shells measure themselves, not the viewport.
4. **Interaction quality** — gestures, keyboard access, and responsive transitions are part of the component API.
