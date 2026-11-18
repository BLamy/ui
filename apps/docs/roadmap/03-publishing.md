---
description: One package, published by one workflow with npm trusted publishing and provenance; what is in it; what happens to the docstream packages; what the owner sets up on npmjs.com.
---

# Publishing

BL publishes one package, `@brett_lamy/ui`. Every library is an entry of it, and docstream, its editor and UI SDK are inside it, so a release is one `npm publish` of one tarball. `.github/workflows/publish.yml` does it on a push to `main`: when the version in `packages/ui/package.json` isn't on npm yet, it builds and tests the library, checks the entry sizes, runs `pnpm pack` and publishes the tarball. Releasing is still just bumping a version.

## What is in the package

The tarball is `packages/ui/dist` and the README.

| In `dist` | What it is | An app imports it as |
| --- | --- | --- |
| `index.js`, `components/`, `lib/` | The kit, one file per source module | `@brett_lamy/ui`, `@brett_lamy/ui/dialog`, `@brett_lamy/ui/lib/theme` |
| `libraries/<entry>.js` | The library entries, generated from the [package map](01-packages.md) | `@brett_lamy/ui/time`, `@brett_lamy/ui/audio`… |
| `cloudflare.js`, `opencode.js` | The two hand-written entries | `@brett_lamy/ui/cloudflare`, `@brett_lamy/ui/opencode` |
| `docstream/`, `docstream-editor/` | Docstream and its editor, compiled a module per file | `@brett_lamy/ui/docstream/…`, `@brett_lamy/ui/docstream-editor/…` |
| `sdk/` | One re-export per UI SDK entry | `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/react/dialog`… |
| `vendor/ui-sdk/core`, `vendor/ui-sdk/react` | The compiled UI SDK fork, with its `LICENSE` (Apache-2.0) and a `NOTICE.md` that names the fork's commit and what it changes | through the `sdk` entries above |
| `index.css`, `theme.css`, docstream's sheets | The stylesheets | `@brett_lamy/ui/styles.css`, `@brett_lamy/ui/theme.css`, `@brett_lamy/ui/docstream/styles.css` |

The last step of the library's build (`packages/ui/scripts/vendor-ui-sdk.mjs`) copies the fork in and points every `@ui-sdk/…` import in `dist` at the copy, so the published package depends on nothing of UI SDK's from npm. The package's license field is `MIT AND Apache-2.0`: BL UI is MIT, the UI SDK inside it Apache-2.0.

`packages/ui-sdk-core` and `packages/ui-sdk-react` are private workspace packages: the compiled output of the `vendor/ui-sdk` submodule, which the library's source imports under upstream's names. They are never published.

## By hand

The workflow's two steps, for a release made from a laptop:

```sh
pnpm nx run-many -t build,test -p @brett_lamy/ui
node tools/size/measure.mjs --check
cd packages/ui && pnpm pack
npm publish brett_lamy-ui-<version>.tgz --access public
```

`pnpm pack` writes the tarball; `npm publish` uploads it.

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

The workflow authenticates with npm's **trusted publishing** (OIDC): npm trusts a GitHub Actions run of this repository's `publish.yml`, so there is no token to store or rotate, and each release carries a provenance statement linking the tarball to the commit that built it. It is configured on npmjs.com, in the settings of `@brett_lamy/ui`:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `BLamy` |
| Repository | `ui` |
| Workflow filename | `publish.yml` |
| Environment | *(leave empty)* |

{% hint style="warning" %}
`@brett_lamy/ui` has no trusted publisher yet, so the workflow has failed with `ENEEDAUTH` and ui has been published by hand. Until the publisher is added, the workflow can publish with an `NPM_TOKEN` repository secret instead: it uses the token when one is set, and the workflow's own identity when none is.
{% endhint %}

### What to do on npmjs.com

| Package | On npm | What to do |
| --- | --- | --- |
| `@brett_lamy/ui` | yes | Add the trusted publisher (the table above). It is the only package that publishes |
| `@brett_lamy/docstream`, `@brett_lamy/docstream-editor` | yes, frozen at 2.0.1 | After 6.0 is out: deprecate them and remove their publishers (above) |

No other name is needed. The libraries are entries of `@brett_lamy/ui`, not packages, and UI SDK ships inside it.

## Versions

One package, one version. Every library moves with it, so there is never a question of which versions of two BL libraries go together. Docstream and its editor are part of the package, so their version is the package's from 6.0 on.

The UI SDK inside a release is the fork as it was when the release was built: upstream's version plus the fork's additions. The `NOTICE.md` in `dist/vendor/ui-sdk` names the commit.

## Before a version goes out

The workflow publishes only when these pass, and they are worth running first on a laptop:

- `pnpm nx run-many -t build,test -p @brett_lamy/ui`: the library builds, and its tests pass. The entry-boundary test loads every built entry in plain Node.
- `node tools/size/measure.mjs --check`: every library entry is within its budget, and a name imported through a library entry or the root costs what its own module entry costs.

If a run fails after the tests, rerunning it publishes the version only if npm still doesn't have it.
