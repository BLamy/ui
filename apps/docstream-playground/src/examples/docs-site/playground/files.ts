/* The starting VFS for the playground: a tiny product's docs, as a folder of Markdown. */
export type Files = Record<string, string>

export const AUTO_TREE: Files = {
  "README.md": `---
description: Rocket is a pretend CLI that ships static sites to the edge.
---

# Rocket

Ship a folder of HTML to 300 cities with one command.

{% hint style="success" %}
Edit any file on the left — the sidebar, search and pages rebuild as you type.
{% endhint %}

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Quick start</strong></td><td>Deploy in a minute. <a href="01-guides/01-quick-start.md">Open →</a></td></tr>
<tr><td><strong>Configuration</strong></td><td>Every option in rocket.toml. <a href="02-reference/config.md">Open →</a></td></tr>
</tbody></table>
`,
  "01-guides/01-quick-start.md": `---
description: From zero to a live URL.
---

# Quick start

{% stepper %}
{% step %}
### Install

{% command %}npm install -g rocket-cli{% endcommand %}
{% endstep %}
{% step %}
### Deploy

\`\`\`sh
rocket deploy ./dist
\`\`\`
{% endstep %}
{% endstepper %}

Next, tune it in [configuration](../02-reference/config.md#regions).
`,
  "01-guides/02-domains.md": `# Custom domains

Point a CNAME at \`edge.rocket.dev\`, then run \`rocket domains add\`.

## Certificates

Issued automatically within a minute.
`,
  "02-reference/config.md": `# Configuration

\`rocket.toml\` lives next to your build output.

## Regions

| Key | Default | Meaning |
| --- | --- | --- |
| \`regions\` | \`["all"]\` | Where to deploy |
| \`ttl\` | \`3600\` | Cache lifetime in seconds |

## Headers

\`\`\`toml title="rocket.toml"
[[headers]]
path = "/*"
cache-control = "public, max-age=600"
\`\`\`
`,
  "02-reference/changelog.md": `# Changelog

{% updates %}
{% update date="2026-10-01" %}
**Added** — HTTP/3 everywhere.
{% endupdate %}
{% update date="2026-09-12" %}
**Fixed** — deploys from Windows paths.
{% endupdate %}
{% endupdates %}
`,
  "assets/logo.png": "(binary — not Markdown, so DocsSite ignores it)",
}

/* The same files, ordered and labelled by a GitBook SUMMARY.md instead of the folders. */
export const WITH_SUMMARY: Files = {
  "SUMMARY.md": `# Table of contents

* [Welcome](README.md)

## Learn

* [Deploy in a minute](01-guides/01-quick-start.md)
  * [Domains](01-guides/02-domains.md)

## Look up

* [rocket.toml](02-reference/config.md)
* [What's new](02-reference/changelog.md)
* [Status page](https://example.com/status)
`,
  ...AUTO_TREE,
}
