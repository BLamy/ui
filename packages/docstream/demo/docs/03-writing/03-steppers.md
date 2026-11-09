---
description: Numbered walkthroughs — step titles from headings, rich step bodies, screenshot thumbnails beside the title, and steppers inside steppers.
---

# Steppers

A stepper is a numbered rail of steps, for anything the reader does in order: install, configure, deploy; reproduce, observe, fix. Each `{% step %}` is a full document, so a step can carry the command to run, the file to edit and the warning to heed — right where the reader needs them.

## A basic stepper

{% tabs sync="example" %}
{% tab title="Preview" %}
{% stepper %}
{% step %}
### Install the package
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}
{% endstep %}
{% step %}
### Import the stylesheet
Once, at your app's entry:

```tsx title="main.tsx" lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
```
{% endstep %}
{% step %}
### Render Markdown
```tsx title="Docs.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"

export function Docs({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} />
}
```
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% stepper %}
{% step %}
### Install the package
{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}
{% endstep %}
{% step %}
### Import the stylesheet
Once, at your app's entry:

```tsx title="main.tsx" lineNumbers="false"
import "@brett_lamy/docstream/styles.css"
```
{% endstep %}
{% step %}
### Render Markdown
```tsx title="Docs.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"

export function Docs({ markdown }: { markdown: string }) {
  return <MarkdownContent markdown={markdown} />
}
```
{% endstep %}
{% endstepper %}
````
{% endtab %}
{% endtabs %}

Steps are numbered in order; there's nothing to renumber when you insert one. Neither `{% stepper %}` nor `{% step %}` takes attributes.

## Step titles

By GitBook convention, **the first heading in a step is its title**. It's drawn beside the step number instead of as a heading, and it stays out of the page outline. Any level works; `###` is the convention. The title is plain text — emphasis in the heading is kept in the source but not drawn.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% stepper %}
{% step %}
## A level-2 title works

The body starts after the title.
{% endstep %}
{% step %}
### **Bold** markers are dropped from the title
…and kept in the source, so the page round-trips.
{% endstep %}
{% step %}
A step without a heading has no title — just its number and its body.
{% endstep %}
{% step %}
### Only the first heading is a title

#### A later heading

…is an ordinary heading in the step's body.
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% stepper %}
{% step %}
## A level-2 title works

The body starts after the title.
{% endstep %}
{% step %}
### **Bold** markers are dropped from the title
…and kept in the source, so the page round-trips.
{% endstep %}
{% step %}
A step without a heading has no title — just its number and its body.
{% endstep %}
{% step %}
### Only the first heading is a title

#### A later heading

…is an ordinary heading in the step's body.
{% endstep %}
{% endstepper %}
````
{% endtab %}
{% endtabs %}

The heading has to be the step's **first block** to become its title. A paragraph before it makes the step untitled, and the heading then renders in the body.

## Rich steps

A step can hold any block. This one walks through adding a docs page with a folder demo — the hint, the file tree, the `meta.json` and the tag all live in their steps:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% stepper %}
{% step %}
### Create the example folder
```txt
demo/src/examples/
  badges/
    status/
      index.tsx    ← default-exports the component
      meta.json    ← optional defaults for the tag
```

{% hint style="info" %}
The folder name is the demo's `src`: `badges/status`.
{% endhint %}
{% endstep %}
{% step %}
### Describe it
```json title="meta.json"
{
  "title": "Status badges",
  "variants": [{ "id": "soft", "label": "Soft" }, { "id": "solid", "label": "Solid" }]
}
```
{% endstep %}
{% step %}
### Drop the tag in a page
```md
{% demo src="badges/status" %}
```

The result, live:

{% demo src="demos/badges" %}
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="Markdown" %}
`````md
{% stepper %}
{% step %}
### Create the example folder
```txt
demo/src/examples/
  badges/
    status/
      index.tsx    ← default-exports the component
      meta.json    ← optional defaults for the tag
```

{% hint style="info" %}
The folder name is the demo's `src`: `badges/status`.
{% endhint %}
{% endstep %}
{% step %}
### Describe it
```json title="meta.json"
{
  "title": "Status badges",
  "variants": [{ "id": "soft", "label": "Soft" }, { "id": "solid", "label": "Solid" }]
}
```
{% endstep %}
{% step %}
### Drop the tag in a page
```md
{% demo src="badges/status" %}
```

The result, live:

{% demo src="demos/badges" %}
{% endstep %}
{% endstepper %}
`````
{% endtab %}
{% endtabs %}

Folder demos are covered in depth on [Demos](../04-interactive/01-demos.md).

## Thumbnails in step headings

Start a step's title heading with a [thumbnail image](01-markdown-basics.md#thumbnails) and the screenshot takes a column of its own, with the title and the step's body beside it. Hovering or focusing the thumbnail opens the full image. It's the shape for bug reports and QA journeys, where every step has a screenshot and a timestamp:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% stepper %}
{% step %}
### ![Sign-in](https://placehold.co/1280x800/e8e8f2/5b5bd6/png?text=Sign+in "thumbnail: 0:04.1") Signed in as an operator
The session cookie is set and the console redirects to **Overview**.
{% endstep %}
{% step %}
### ![Overview](https://placehold.co/1280x800/f2ece8/d65b5b/png?text=Overview "thumbnail: 0:39.8") Overview loads with Unauthorized
The stats ticker shows "Stats unavailable — retrying" instead of numbers.

```txt
GET /api/stats → 401 Unauthorized
```
{% endstep %}
{% step %}
### ![Retry](https://placehold.co/1280x800/e8f2ea/2f9e57/png?text=Recovered "thumbnail: 0:47.2") Recovers after the token refresh
{% hint style="success" %}
The second request carries the refreshed token and succeeds.
{% endhint %}
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% stepper %}
{% step %}
### ![Sign-in](https://placehold.co/1280x800/e8e8f2/5b5bd6/png?text=Sign+in "thumbnail: 0:04.1") Signed in as an operator
The session cookie is set and the console redirects to **Overview**.
{% endstep %}
{% step %}
### ![Overview](https://placehold.co/1280x800/f2ece8/d65b5b/png?text=Overview "thumbnail: 0:39.8") Overview loads with Unauthorized
The stats ticker shows "Stats unavailable — retrying" instead of numbers.

```txt
GET /api/stats → 401 Unauthorized
```
{% endstep %}
{% step %}
### ![Retry](https://placehold.co/1280x800/e8f2ea/2f9e57/png?text=Recovered "thumbnail: 0:47.2") Recovers after the token refresh
{% hint style="success" %}
The second request carries the refreshed token and succeeds.
{% endhint %}
{% endstep %}
{% endstepper %}
````
{% endtab %}
{% endtabs %}

The step's title text leaves the image out (`Overview loads with Unauthorized`). Only an image **first** in the heading gets the column; a thumbnail later in the heading stays inline.

## Nesting

Steppers nest — in each other, in tabs, in hints. A stepper inside a step makes sub-steps; a stepper inside synced tabs gives each platform its own walkthrough:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% stepper %}
{% step %}
### Prepare the release
{% stepper %}
{% step %}
### Bump the version
`npm version minor` — exact pins, no ranges.
{% endstep %}
{% step %}
### Update the changelog
Add an `{% update %}` entry at the top of the [changelog](07-changelogs.md).
{% endstep %}
{% endstepper %}
{% endstep %}
{% step %}
### Publish
{% tabs sync="os" %}
{% tab title="macOS / Linux" %}
{% stepper %}
{% step %}
### Log in
```sh
npm login
```
{% endstep %}
{% step %}
### Publish
```sh
npm publish --access public
```
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="CI" %}
Push a tag; the release workflow publishes with `NPM_TOKEN`:

```sh
git push origin v1.19.0
```
{% endtab %}
{% endtabs %}
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% stepper %}
{% step %}
### Prepare the release
{% stepper %}
{% step %}
### Bump the version
`npm version minor` — exact pins, no ranges.
{% endstep %}
{% step %}
### Update the changelog
Add an `{% update %}` entry at the top of the [changelog](07-changelogs.md).
{% endstep %}
{% endstepper %}
{% endstep %}
{% step %}
### Publish
{% tabs sync="os" %}
{% tab title="macOS / Linux" %}
{% stepper %}
{% step %}
### Log in
```sh
npm login
```
{% endstep %}
{% step %}
### Publish
```sh
npm publish --access public
```
{% endstep %}
{% endstepper %}
{% endtab %}
{% tab title="CI" %}
Push a tag; the release workflow publishes with `NPM_TOKEN`:

```sh
git push origin v1.19.0
```
{% endtab %}
{% endtabs %}
{% endstep %}
{% endstepper %}
````
{% endtab %}
{% endtabs %}

Nested steps count from 1 again. Around two levels is the readable limit.

## Rules of thumb

- **2–7 steps.** One step is a paragraph; ten steps are two steppers with a heading between them.
- **One action per step**, phrased as an imperative title: "Install the package", not "Installation".
- **Put the artifact in the step** — the command, the diff, the screenshot — not in a paragraph after the stepper.
- **Streaming is safe.** While an answer streams in, each `{% step %}` appears as it arrives; an unclosed stepper renders the steps it has so far.

## Next

{% content-ref url="04-layout.md" %}
Layout — columns, card grids, link cards, files and figures
{% endcontent-ref %}
