---
description: How BL became one repository and one npm package, with every library an entry of @brett_lamy/ui, and what is left to do.
---

# The plan

BL started as three repositories: `@brett_lamy/ui` here, and docstream and docstream-editor beside it, each with its own docs site, publish workflow and release order to get right. Now it is one repository and one npm package. Docstream, its editor and our build of UI SDK are inside `@brett_lamy/ui`, every library is an entry of it (`@brett_lamy/ui/time`, `@brett_lamy/ui/audio`), and the package root is the core. An app installs one thing and bundles only the entries it imports. The owner publishes one thing.

The plan used to end somewhere else: `@brett_lamy/ui` split into about twenty npm packages, with the root re-exporting everything for a major version and a 7.0 that removed the re-exports. It ends in 6.0 instead, with the libraries as entries of one package. [Why one package](#why-one-package) says why.

## Where things stand

{% stepper %}
{% step %}
### One repository — done

docstream and docstream-editor moved into this repo **with their full history** (PR #10, October 2026). This site hosts their docs at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).
{% endstep %}

{% step %}
### Docstream inside the library — done

On 2026-11-16 docstream and its editor became **part of `@brett_lamy/ui`**: their sources are `packages/ui/src/docstream` and `packages/ui/src/docstream-editor`, every entry they had is the same module under the library's name (`@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream/site`, `@brett_lamy/ui/docstream-editor`…), and they are built, tested and versioned with the kit. Their docs and live examples live in `apps/docstream-playground` and `apps/docstream-editor-playground`. The npm packages `@brett_lamy/docstream` and `@brett_lamy/docstream-editor` **stop at 2.0.1**; see [Migrating](06-migration.md).
{% endstep %}

{% step %}
### UI SDK inside the package — in 6.0

Every interactive part is built on [UI SDK](https://ui-sdk.dev), from our fork in `vendor/ui-sdk`. The package ships its own build of it: the library's build copies the compiled fork into `dist/vendor/ui-sdk`, with its license, and every UI SDK entry is an entry of the package. Wherever UI SDK's docs say `@ui-sdk/…`, an app writes `@brett_lamy/ui/sdk/…`. There is no second package to install or publish, and one copy of UI SDK's layer stack and focus state in a page.
{% endstep %}

{% step %}
### Libraries as entries — in 6.0

The [package map](01-packages.md) is no longer a plan for packages: it is the list of the libraries inside the one package. `apps/docs/src/site/libraries.ts` gives each library the units of `packages/ui/src` it owns, and the registry build writes an entry for each from it: `@brett_lamy/ui/tokens`, `/motion`, `/icons`, `/time`, `/canvas`, `/diagram`, `/audio`, `/video`, `/markdown`, `/composer`, `/replay`, `/sql`, `/pglite`, `/filter`, `/sync`, `/vault` and `/tailscale`, beside the hand-written `/cloudflare` and `/opencode`, docstream's entries and UI SDK's. A name has two import paths and no more: its module's entry (`@brett_lamy/ui/waveform`) and its library's (`@brett_lamy/ui/audio`). The [module map](02-module-map.md) gives every unit its library, and a test holds the list to the real import graph.
{% endstep %}

{% step %}
### The root is the core — in 6.0

`@brett_lamy/ui` itself exports the core library and the foundation under it (Tokens, Motion, Icons), and nothing of another library. So importing the root never loads the Markdown editor, a diagram or a video timeline. The registry build fails when the root re-exports a module that belongs to another library. This is what the old plan called 7.0; it ships in 6.0, which is a breaking release already.
{% endstep %}

{% step %}
### A shadcn item per library — in 6.0

Every part still installs as source with the shadcn CLI. The registry adds one item per library, `library-<entry>` (`library-ui` is the core), which installs every item of that library. UI SDK and docstream are not copied: an item whose files use either installs `@brett_lamy/ui` and imports them by the package's name.
{% endstep %}

{% step %}
### Sizes checked — in 6.0

"You only ship what you import" is measured. `pnpm size` bundles every library entry from the built package the way an app's bundler would, and CI fails when an entry grows past its budget or when a name imported through a library entry or the root costs more than through its own module entry. The [package map](01-packages.md) shows what each entry loads.
{% endstep %}

{% step %}
### Motion on demand — in 6.0

The animation engine (framer-motion) is one lazy chunk, asked for at idle after a part that can animate mounts. A Button with a text label used to load all of it for a morph that only runs when the label changes; it now loads about a third of what it did, and so does everything built on it.
{% endstep %}

{% step %}
### Sandboxing — Sandbox in 6.0, Linux VM planned

Two ways to run code a person or a model wrote, in the tab, named for the choice. **Sandbox** (`@brett_lamy/ui/sandbox`) is the one almost everyone should use: a Node-compatible runtime with a disk, a shell and npm, in a Worker with an origin of its own, so the code cannot read the page or its storage. It costs the page a few kilobytes; the runtime is an optional peer that loads when a sandbox starts. Previews are not in this version. **Linux VM** (`@brett_lamy/ui/linux-vm`) is planned for what Sandbox cannot do: a real kernel, native binaries, container images. It is heavy (tens to hundreds of megabytes), far slower than native and not optimized, and it will share Sandbox's interface. Neither runtime is ever part of the npm tarball.
{% endstep %}

{% step %}
### Publish 6.0 — next

One package, one `npm publish`. Before it, the owner adds this repository's `publish.yml` as the trusted publisher of `@brett_lamy/ui` on npmjs.com; after it, the two docstream packages are deprecated with a pointer to their new names. [Publishing](03-publishing.md) has the settings and the commands.
{% endstep %}

{% step %}
### Docs for every library — next

Each library gets a folder of Markdown and examples, published here with docstream's DocsSite, the way docstream's own docs work today. The ui docs pages move to the libraries they describe, and the [coverage gaps](04-docs.md) get pages.
{% endstep %}

{% step %}
### Tidy the repository — next

`apps/docs` becomes `apps/site`, `registry/` becomes `blocks/`, the desktop wrappers move from `tools/` to `apps/`, and the old docstream repositories are archived with a pointer here. None of it changes what an app installs or imports. See [Repository layout](05-repo-layout.md).
{% endstep %}
{% endstepper %}

## Why one package

- **One thing to publish.** One version, one workflow, one trusted publisher on npm. There is no release order to get right and no set of versions that must match: any `@brett_lamy/ui` is a complete, consistent set of libraries.
- **One thing to install.** `npm install @brett_lamy/ui`, and every library is there when an app wants it. An import path says which library a name comes from; no `package.json` has to change to start using one.
- **The bundle is still only what you import.** The package is one file per module with no side effects but its stylesheets, and each library is its own entry, so an app that never imports `@brett_lamy/ui/diagram` never bundles a diagram. That was the first reason to split, and entries deliver it without packages. It is checked, not assumed: see "Sizes checked" above.
- **One copy of UI SDK.** The kit, docstream and an app's own UI SDK components run on the one build the package carries, so they share one layer stack and one focus state.
- **Layers you can rely on.** Each library builds only on the libraries below it. The rule is checked against the real imports (`apps/docs/src/site/libraries.test.ts`), with the few lazy links against it listed on the [module map](02-module-map.md).

What one package does not do is keep a library's npm dependencies out of `node_modules`. Installing `@brett_lamy/ui` puts Tiptap, framer-motion, the time parsers, rrweb and the rest on disk whether or not the app imports the library that uses them. They stay out of the bundle. The large optional ones (`xstate`, `elkjs`, PGlite, the Tailscale client, the agent runtime) are optional peers: an app installs them only when it uses the library that needs them.

## What doesn't change

{% hint style="success" %}
**The shadcn registry keeps working as it is.** Registry items copy source with `@/components/ui/<x>` and `@/lib/<x>` imports; they keep those paths and names, and `blamy.github.io/ui/r/<item>.json` keeps serving them. The `library-<entry>` items are additions.
{% endhint %}

- Every module keeps its own entry (`@brett_lamy/ui/dialog`), at the registry's path under the package name. A library entry is a second path to the same names, never a replacement.
- Docs links stay: `#/<page>` URLs for the ui pages keep working when the pages move.
- One version: the libraries are one package, so they cannot drift. Docstream's version is the library's from 6.0 on.

## Read on

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Package map</strong></td><td>Every library: its entry, its shadcn item, what it loads, what it builds on. <a href="01-packages.md">Packages →</a></td></tr>
<tr><td><strong>Module map</strong></td><td>Every unit of packages/ui/src and the library it belongs to. <a href="02-module-map.md">Modules →</a></td></tr>
<tr><td><strong>Publishing</strong></td><td>One package, trusted publishing, and the docstream packages' last steps. <a href="03-publishing.md">Publishing →</a></td></tr>
<tr><td><strong>Docs</strong></td><td>How each library's docs are built, and what isn't documented yet. <a href="04-docs.md">Docs →</a></td></tr>
<tr><td><strong>Repository layout</strong></td><td>Where everything lives, and what still moves. <a href="05-repo-layout.md">Layout →</a></td></tr>
<tr><td><strong>Migrating</strong></td><td>What an app changes for 6.0: one install, the entries, docstream's and UI SDK's names. <a href="06-migration.md">Migrating →</a></td></tr>
</tbody></table>
