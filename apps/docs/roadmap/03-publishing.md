---
description: One workflow publishes every package with npm trusted publishing and provenance; what 6.0 publishes; what happens to the docstream packages; what the owner sets up on npmjs.com.
---

# Publishing

Every package publishes from `.github/workflows/publish.yml` on a push to `main`: for each package whose `package.json` version isn't on npm yet, in dependency order, it runs `pnpm pack` (which turns `workspace:*` into exact versions) and `npm publish`. Releasing is still just bumping a version.

## What 6.0 publishes

| Order | Package | What it is |
| --- | --- | --- |
| 1 | `@brett_lamy/ui-sdk-core` | Our UI SDK fork's framework-free core, built from `vendor/ui-sdk` |
| 2 | `@brett_lamy/ui-sdk-react` | The fork's React parts |
| 3 | `@brett_lamy/ui` | The kit, with docstream and its editor inside |

`@brett_lamy/ui` depends on the two wrappers under upstream's names (`"@ui-sdk/core": "npm:@brett_lamy/ui-sdk-core@…"`), so an app imports `@ui-sdk/react/dialog` exactly as it would from upstream. The wrappers' versions are prereleases (upstream's version plus a `.bl.N` suffix), and the workflow publishes them under the `latest` tag so a plain install finds them.

## Docstream and the editor

`@brett_lamy/docstream` and `@brett_lamy/docstream-editor` **stop at 2.0.1**. From 6.0 they are entries of `@brett_lamy/ui` (`@brett_lamy/ui/docstream/…`, `@brett_lamy/ui/docstream-editor/…`), and nothing is published under the old names again. What's left to do on npm, once 6.0 is out:

{% stepper %}
{% step %}
### Point people at the new names

Deprecate every version with a message that says where they went, so `npm install` shows it:

{% command %}npm deprecate @brett_lamy/docstream "Part of @brett_lamy/ui since 6.0: import @brett_lamy/ui/docstream" && npm deprecate @brett_lamy/docstream-editor "Part of @brett_lamy/ui since 6.0: import @brett_lamy/ui/docstream-editor"{% endcommand %}
{% endstep %}

{% step %}
### Remove their trusted publishers

They pointed at `BLamy/docstream` and `BLamy/docstream-editor`. Nothing publishes them now, so the publishers can go, and the two repositories can be archived with a pointer to [the migration](06-migration.md).
{% endstep %}
{% endstepper %}

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
npm only lets you add a trusted publisher to a package that already exists. A brand-new name needs one ordinary publish first — `node tools/release/placeholders.mjs` packs a `0.0.0` placeholder for every package in the plan that isn't on npm yet (`--list` only prints them), and prints the `npm publish` command for each. It publishes nothing itself.
{% endhint %}

### The packages

| Package | On npm | What to do |
| --- | --- | --- |
| `@brett_lamy/ui` | yes | Add the trusted publisher (it has none, so the workflow has failed with `ENEEDAUTH` and ui has been published by hand) |
| `@brett_lamy/ui-sdk-core`, `@brett_lamy/ui-sdk-react` | no | Before 6.0: publish the placeholder, then add the trusted publisher |
| `@brett_lamy/docstream`, `@brett_lamy/docstream-editor` | yes, frozen at 2.0.1 | Deprecate them and remove their publishers (above) |
| `@brett_lamy/tokens`, `motion`, `icons`, `time`, `canvas`, `diagram`, `media`, `composer`, `sql`, `pglite`, `filter`, `sync`, `vault`, `tailscale`, `opencode`, `registry` | no | When the split begins: publish the placeholder, then add the trusted publisher |

The live list is the [package map](01-packages.md); the workflow's package list grows as each package lands. `@brett_lamy/registry` is also the name of the workspace's private `registry/` package today; the split renames that one (`blocks/`, see [Repository layout](05-repo-layout.md)) before the CLI takes the name.

## Versions

| Group | Packages | Rule |
| --- | --- | --- |
| BL | `@brett_lamy/ui` and every package split from it | **Lockstep.** One version, from 6.0, so any set of BL packages at the same version works together. Docstream and its editor are part of ui, so they move with it. |
| UI SDK | `ui-sdk-core`, `ui-sdk-react` | Upstream's version plus `.bl.N`; they move when the fork does, and ui pins the exact version it was built with. |
| Tools | `registry` | Its own version. |

A package's version moves only when its group releases. Lockstep costs some empty releases and buys never having to ask which versions of two BL packages go together.

## Order

The workflow publishes dependencies first — the UI SDK wrappers, then `@brett_lamy/ui`, and after the split the BL packages from the foundation up — so a package never reaches npm before something it pins. If a run fails halfway, rerunning it skips whatever already published.
