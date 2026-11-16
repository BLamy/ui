---
description: What an app changes — docstream's new names in 6.0, then the split — and when.
---

# Migrating

## If you use @brett_lamy/docstream or @brett_lamy/docstream-editor

They stop at **2.0.1**. From `@brett_lamy/ui` 6.0 they are part of the library: the same modules, under the library's name. Install the library instead, and rename the imports:

| Before (2.0.1) | From 6.0 |
| --- | --- |
| `npm install @brett_lamy/docstream @brett_lamy/docstream-editor` | `npm install @brett_lamy/ui` (it brings both) |
| `@brett_lamy/docstream` | `@brett_lamy/ui/docstream` |
| `@brett_lamy/docstream/<entry>` (`site`, `gitbook`, `replay`, `stl`, `strudel`, …) | `@brett_lamy/ui/docstream/<entry>` |
| `@brett_lamy/docstream/styles.css` | `@brett_lamy/ui/docstream/styles.css` |
| `@brett_lamy/docstream-editor` | `@brett_lamy/ui/docstream-editor` |
| `@brett_lamy/docstream-editor/<entry>` (`editor`, `convert`, `styles.css`) | `@brett_lamy/ui/docstream-editor/<entry>` |

The components, props and Markdown are 2.0.1's. Optional peers stay optional (`@brett_lamy/viz-engine` for the viz fence), and one of 2.0.1's dependencies becomes an optional peer: install `xstate` yourself if your pages draw `xstate` fences. The editor's stylesheet is already inside `@brett_lamy/ui/styles.css`; import `@brett_lamy/ui/docstream-editor/styles.css` only in an app that doesn't load the kit's. Two things come with the library that 2.0.1 didn't have: the `capnp` fence draws a workerd config on a CloudflareDiagram, and the `xstate` fence keeps a machine's `invoke`. The full list, with the stylesheet order, is in the 6.0 migration guide's [Docstream section](https://blamy.github.io/ui/#/migrating-to-6#docstream-is-part-of-the-library).

{% hint style="info" %}
The version of docstream you get is the library's: `@brett_lamy/ui@6.0.0` carries docstream as it was when 6.0 shipped. There is no separate version to keep in step any more.
{% endhint %}

## If you copy source with the registry

Nothing changes through the split. Items keep their names, paths and `@/components/ui/<x>` imports. (The move from 5.x to 6.0 is its own story: see [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).)

## If you install @brett_lamy/ui

{% stepper %}
{% step %}
### 6.x — the split lands, nothing breaks

The new packages ship alongside `@brett_lamy/ui`, all at the same version. ui re-exports everything it exports today, so existing imports keep working. Imports that now have a better home are marked `@deprecated` in the types, naming the package to import from.
{% endstep %}

{% step %}
### Move imports when it suits you

A codemod, shipped with the split, rewrites the imports for you:

{% command %}npx @brett_lamy/registry codemod split ./src{% endcommand %}

It moves each name to its package (`import { NaturalTimeInput } from '@brett_lamy/ui/natural-time-input'` → `from '@brett_lamy/time'`) and adds those packages to `package.json`. Install only the packages your app uses, and ui stops pulling in the rest. Docstream's imports don't move: it stays in `@brett_lamy/ui`.
{% endstep %}

{% step %}
### 7.0 — the core only

The re-exports are removed. `@brett_lamy/ui` exports its primitives, containers, docstream and its editor; everything else comes from its own package.
{% endstep %}
{% endstepper %}

## Stylesheets

`@brett_lamy/ui/styles.css` keeps covering every BL package through 6.x. From 7.0 each package with styles ships its own `styles.css`, and `@brett_lamy/tokens/theme.css` carries the theme.

## The docstream shims

`ReplayPreview`, `StlViewer`, `StrudelPlayer` and `TuiPreview` are thin components that re-export docstream widgets for the kit's docs and registry. With docstream inside the library they stay: they are the kit's entries for those widgets, and the registry items that copy them.
