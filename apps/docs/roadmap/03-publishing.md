---
description: One workflow publishes every package with npm trusted publishing and provenance; how versions are grouped; what the owner sets up on npmjs.com.
---

# Publishing

Every package publishes from `.github/workflows/publish.yml` on a push to `main`: for each package whose `package.json` version isn't on npm yet, in dependency order, it runs `pnpm pack` (which turns `workspace:*` into exact versions) and `npm publish`. Releasing is still just bumping a version.

## Trusted publishing

The workflow authenticates with npm's **trusted publishing** (OIDC): npm trusts a GitHub Actions run of this repository's `publish.yml`, so there is no token to store or rotate, and each release carries a provenance statement linking the tarball to the commit that built it. It is configured **per package** on npmjs.com:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `BLamy` |
| Repository | `ui` |
| Workflow filename | `publish.yml` |
| Environment | *(leave empty)* |

{% hint style="warning" %}
npm only lets you add a trusted publisher to a package that already exists. A brand-new name needs one ordinary publish first — `node tools/release/placeholders.mjs` packs a `0.0.0` placeholder for every planned package that isn't on npm, and prints the `npm publish` command for each.
{% endhint %}

### The packages

| Package | On npm | What to do |
| --- | --- | --- |
| `@brett_lamy/docstream` | yes | Change its trusted publisher from `BLamy/docstream` to `BLamy/ui` + `publish.yml` |
| `@brett_lamy/docstream-editor` | yes | Change its trusted publisher from `BLamy/docstream-editor` to `BLamy/ui` + `publish.yml` |
| `@brett_lamy/ui` | yes | Add the trusted publisher (it has none, so the workflow has failed with `ENEEDAUTH` and ui has been published by hand) |
| `@brett_lamy/tokens`, `icons`, `motion`, `time`, `canvas`, `media`, `markdown`, `composer`, `sql`, `pglite`, `filter`, `sync`, `vault`, `tailscale`, `registry` | no | Publish the placeholder, then add the trusted publisher |

The live list is the [package map](01-packages.md); the workflow's `PACKAGES` line grows as each package lands.

## Versions

| Group | Packages | Rule |
| --- | --- | --- |
| Docstream | docstream, docstream-editor | **Lockstep.** The editor's version equals the docstream it pins; bump both together. |
| BL UI | tokens, icons, motion, ui and the feature packages | **Lockstep.** All share one version, starting at **6.0.0** with the split, so any set of BL UI packages at the same version works together. |
| Tools | registry | Its own version. |

A package's version moves only when its group releases. Lockstep costs some empty releases and buys never having to ask which versions of two BL packages go together.

## Order

The workflow publishes dependencies first — docstream, then the editor, then the BL UI packages from the foundation up — so a package never reaches npm before something it pins. If a run fails halfway, rerunning it skips whatever already published.
