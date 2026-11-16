---
description: How BL became one repository and one library with docstream inside it, what 6.0 publishes, and how @brett_lamy/ui splits next.
---

# The plan

BL started as three repositories: `@brett_lamy/ui` here, and docstream and docstream-editor beside it, each with its own docs site, publish workflow and release order to get right. Now it is one repository and one library: docstream and its editor are part of `@brett_lamy/ui`, the site you're reading hosts every library's docs, and the next step is to split the parts an app may not need into packages of their own, so an app installs what it uses and every part has docs of its own.

## Where things stand

{% stepper %}
{% step %}
### One repository — done

docstream and docstream-editor moved into this repo **with their full history** (PR #10, October 2026). This site hosts their docs at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).
{% endstep %}

{% step %}
### One library — done

On 2026-11-16 docstream and its editor became **part of `@brett_lamy/ui`**: their sources are `packages/ui/src/docstream` and `packages/ui/src/docstream-editor`, every entry they had is the same module under the library's name (`@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream/site`, `@brett_lamy/ui/docstream-editor`…), and they are built, tested and versioned with the kit. Their docs and live examples live in `apps/docstream-playground` and `apps/docstream-editor-playground`. The npm packages `@brett_lamy/docstream` and `@brett_lamy/docstream-editor` **stop at 2.0.1**; see [Migrating](06-migration.md).
{% endstep %}

{% step %}
### @brett_lamy/ui 6.0 — next

The release this site describes: every interactive part on [UI SDK](https://ui-sdk.dev), the components consolidated so every concept has one name, a subpath entry per module (`@brett_lamy/ui/dialog`), docstream inside, and the Diagram family (Diagram, DiagramFrame, StateDiagram, CloudflareDiagram). It publishes three packages: `@brett_lamy/ui` and the two UI SDK wrappers it depends on, `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react`.
{% endstep %}

{% step %}
### Trusted publishing — by the owner

npm's trusted publishing lets `publish.yml` publish each package with no token, and attaches provenance. It is configured per package on npmjs.com, and a package has to exist before it can be configured. [Publishing](03-publishing.md) lists every package and the exact settings.
{% endstep %}

{% step %}
### Split @brett_lamy/ui

The parts an app may not need move into the libraries the [package map](01-packages.md) describes: tokens, motion and icons beneath the core, and feature packages above it (time, canvas, diagram, media, composer, sql, pglite, filter, sync, vault, tailscale, opencode). Docstream and its editor stay in `@brett_lamy/ui`: the docs, MarkdownView, MarkdownEditor and the Composer all run on them. `@brett_lamy/ui` keeps re-exporting everything for a major version, so no import breaks on the way. The [module map](02-module-map.md) gives every unit its home, and a test already holds the plan to the real import graph.
{% endstep %}

{% step %}
### Docs for every library

Each package gets a folder of Markdown and examples, published here with docstream's DocsSite — the way docstream's own docs work today. The ui docs pages move into the libraries they describe, and the [coverage gaps](04-docs.md) get pages.
{% endstep %}

{% step %}
### Tidy the repository

`apps/docs` becomes `apps/site`, `registry/` becomes `blocks/`, the desktop wrappers move from `tools/` to `apps/`, and the old docstream repositories are archived with a pointer here. See [Repository layout](05-repo-layout.md).
{% endstep %}

{% step %}
### @brett_lamy/ui 7.0

The re-exports go. `@brett_lamy/ui` is the core — primitives, containers, docstream and its editor — and nothing else.
{% endstep %}
{% endstepper %}

## Why split

- **Install what you use.** A subpath entry per module already keeps what you don't import out of your bundle. It doesn't keep it out of your `node_modules`: installing `@brett_lamy/ui` brings the time parsers (gpu-time, gpu-cron, cronstrue), PencilKit's ink (perfect-freehand), the terminal (wterm), rrweb, and whatever the Diagram family needs, whether or not the app draws a diagram or parses a time. After the split each of those comes only with the package that uses it.
- **Docs that match the package.** One library, one docs site, one changelog — instead of 140-odd pages under one sidebar.
- **Layers you can rely on.** Each tier builds only on the tiers below it. The rule is checked today (`apps/docs/src/site/libraries.test.ts`) and enforced after the split by Nx module-boundary tags.

## What doesn't change

{% hint style="success" %}
**The shadcn registry keeps working as it is.** Registry items copy source with `@/components/ui/<x>` and `@/lib/<x>` imports; they keep those paths, and `blamy.github.io/ui/r/<item>.json` keeps serving them. Only npm installs see new package names.
{% endhint %}

- Source keeps its alias imports. A package's build rewrites an alias that points into *another* package to that package's name (the module map is the lookup), so npm packages depend on each other while the registry still copies source.
- Docs links stay: `#/<page>` URLs for the ui pages keep working when the pages move.
- One version for the family: `@brett_lamy/ui` and every package split from it share a version, so any set of BL packages at the same version works together. Docstream's version is the library's from 6.0 on.

## Read on

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Package map</strong></td><td>Every library, what it owns, what it builds on, where it ships. <a href="01-packages.md">Packages →</a></td></tr>
<tr><td><strong>Module map</strong></td><td>Every unit of packages/ui/src and the library it belongs to. <a href="02-module-map.md">Modules →</a></td></tr>
<tr><td><strong>Publishing</strong></td><td>Trusted publishing, versions and the release order. <a href="03-publishing.md">Publishing →</a></td></tr>
<tr><td><strong>Docs</strong></td><td>How each library's docs are built, and what isn't documented yet. <a href="04-docs.md">Docs →</a></td></tr>
<tr><td><strong>Repository layout</strong></td><td>Where everything lives today and after the split. <a href="05-repo-layout.md">Layout →</a></td></tr>
<tr><td><strong>Migrating</strong></td><td>What an app changes: docstream's new names, then the split. <a href="06-migration.md">Migrating →</a></td></tr>
</tbody></table>
