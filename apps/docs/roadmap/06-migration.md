---
description: What an app that uses @brett_lamy/ui changes during the split, and when.
---

# Migrating

## If you copy source with the registry

Nothing changes. Items keep their names, paths and `@/components/ui/<x>` imports.

## If you install @brett_lamy/ui

{% stepper %}
{% step %}
### 6.0 — nothing breaks

The split ships as `@brett_lamy/ui` 6.0 alongside the new packages, all at 6.0.0. ui re-exports everything it exports today, so existing imports keep working. Imports that now have a better home are marked `@deprecated` in the types, naming the package to import from.
{% endstep %}

{% step %}
### Move imports when it suits you

A codemod, shipped with the split, rewrites the imports for you:

{% command %}npx @brett_lamy/registry codemod split ./src{% endcommand %}

It moves each name to its package (`import { TimeInput } from '@brett_lamy/ui'` → `from '@brett_lamy/time'`) and adds those packages to `package.json`. Install only the packages your app uses, and ui stops pulling in the rest.
{% endstep %}

{% step %}
### 7.0 — the core only

The re-exports are removed. `@brett_lamy/ui` exports its primitives and containers; everything else comes from its own package.
{% endstep %}
{% endstepper %}

## Stylesheets

`@brett_lamy/ui/styles.css` keeps covering every BL UI package through 6.x. From 7.0 each package with styles ships its own `styles.css`, and `@brett_lamy/tokens/theme.css` carries the theme.

## The docstream shims

`ReplayPreview`, `StlViewer`, `StrudelPlayer`, `StrudelRack` and the Strudel syntax helpers are re-exports of docstream today. They stay in 6.x and go in 7.0 — import them from `@brett_lamy/docstream/replay`, `/stl` and `/strudel`.
