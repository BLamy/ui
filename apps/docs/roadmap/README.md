---
description: How BL becomes a family of packages — docstream and its editor are in this repo now, @brett_lamy/ui splits next, and every library gets docs of its own.
---

# The plan

BL started as three repositories: `@brett_lamy/ui` here, and docstream and docstream-editor beside it, each with its own docs site, publish workflow and release order to get right. This plan makes them one family: one repository, one site, and a package for each thing BL does — so an app installs the parts it uses, and every part has docs of its own.

## Where things stand

{% stepper %}
{% step %}
### One repository — done

docstream and docstream-editor moved into this repo **with their full history**, at `packages/docstream` and `packages/docstream-editor`. They are workspace packages now: ui, the registry, the docs and the catalog depend on them as `workspace:*`, so a docstream change shows up in BL UI without a release. One workflow publishes all three, in dependency order. This site hosts their docs at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).
{% endstep %}

{% step %}
### Trusted publishing — next, by the owner

npm's trusted publishing lets `publish.yml` in this repo publish each package with no token, and attaches provenance. It is configured per package on npmjs.com, and a package has to exist before it can be configured. [Publishing](03-publishing.md) lists every package and the exact settings.
{% endstep %}

{% step %}
### Split @brett_lamy/ui

The modules in `packages/ui/src` move into the libraries the [package map](01-packages.md) describes — tokens, icons, motion, the core, and twelve feature packages. `@brett_lamy/ui` 6.0 keeps re-exporting everything, so no import breaks on the way. The [module map](02-module-map.md) gives every file its new home; a test already holds the plan to the real import graph.
{% endstep %}

{% step %}
### Docs for every library

Each package gets a `docs/` folder of Markdown and examples, published here with docstream's DocsSite — the way docstream's own docs work today. The ui docs pages move into the libraries they describe, and the [coverage gaps](04-docs.md) get pages.
{% endstep %}

{% step %}
### Tidy the repository

`apps/docs` becomes `apps/site`, `registry/` becomes `blocks/`, the desktop wrappers move from `tools/` to `apps/`, and the old docstream repositories are archived with a pointer here. See [Repository layout](05-repo-layout.md).
{% endstep %}

{% step %}
### @brett_lamy/ui 7.0

The re-exports go. `@brett_lamy/ui` is the core — primitives and containers — and nothing else.
{% endstep %}
{% endstepper %}

## Why split

- **Install what you use.** Installing `@brett_lamy/ui` today brings docstream, its editor, nine Tiptap packages, rrweb and three gpu-* parsers, whether or not the app renders Markdown or parses a time. After the split, the core depends on none of them.
- **Docs that match the package.** One library, one docs site, one changelog, one version — instead of 130 pages under one sidebar.
- **Layers you can rely on.** Each tier builds only on the tiers below it. The rule is checked today (`apps/docs/src/site/libraries.test.ts`) and enforced after the split by Nx module-boundary tags.

## What doesn't change

{% hint style="success" %}
**The shadcn registry keeps working as it is.** Registry items copy source with `@/components/ui/<x>` and `@/lib/<x>` imports; they keep those paths, and `blamy.github.io/ui/r/<item>.json` keeps serving them. Only npm installs see new package names.
{% endhint %}

- Source keeps its alias imports. A package's build rewrites an alias that points into *another* package to that package's name (the module map is the lookup), so npm packages depend on each other while the registry still copies source.
- Docs links stay: `#/<page>` URLs for the ui pages redirect to their new homes.
- docstream and docstream-editor keep their names, their versions and their lockstep rule: the editor's version always equals the docstream it pins.

## Read on

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Package map</strong></td><td>Every library, what it owns, what it builds on. <a href="01-packages.md">Packages →</a></td></tr>
<tr><td><strong>Module map</strong></td><td>Every file in packages/ui/src and the package it moves to. <a href="02-module-map.md">Modules →</a></td></tr>
<tr><td><strong>Publishing</strong></td><td>Trusted publishing, versioning and the release order. <a href="03-publishing.md">Publishing →</a></td></tr>
<tr><td><strong>Docs</strong></td><td>How each library's docs are built, and what isn't documented yet. <a href="04-docs.md">Docs →</a></td></tr>
<tr><td><strong>Repository layout</strong></td><td>Where everything lives once the split is done. <a href="05-repo-layout.md">Layout →</a></td></tr>
<tr><td><strong>Migrating</strong></td><td>What an app changes, and when. <a href="06-migration.md">Migrating →</a></td></tr>
</tbody></table>
