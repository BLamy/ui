# Attributions

BL UI is built on other people's open-source work. This page lists the third-party libraries the components, blocks and docs use, what each one does here, and its license. Versions are the ones this release pins. Each project's own license text ships with its npm package, and the links go to the projects.

{% hint style="info" %}
Most of these are MIT, ISC, BSD or Apache-2.0. Two need a closer look before you ship them in a closed-source app. **Strudel** (`@strudel/web`, used by docstream's Strudel player and the Strudel Studio and Apple Music blocks) is **AGPL-3.0-or-later**. **FFmpeg** (the video tools' WebAssembly build) is **LGPL-2.1+**.
{% endhint %}

## Foundations

| Library | Used for | License |
| --- | --- | --- |
| [React](https://react.dev) and React DOM 19 | Everything | MIT |
| [React Aria](https://react-spectrum.adobe.com/react-aria/) (`react-aria`, `react-aria-components`, `@internationalized/date`) by Adobe | Accessible behavior for nearly every component: buttons, menus, dialogs, lists, pickers, focus and keyboard handling, dates | Apache-2.0 |
| [Tailwind CSS](https://tailwindcss.com) 4 | Styling, through the design tokens | MIT |
| [shadcn/ui](https://ui.shadcn.com) | The registry format and the `shadcn` CLI that copies components into your project | MIT |
| [class-variance-authority](https://cva.style) | Variant recipes | Apache-2.0 |
| [clsx](https://github.com/lukeed/clsx) and [tailwind-merge](https://github.com/dcastil/tailwind-merge) | Class names (`cn`) | MIT |
| [Motion](https://motion.dev) (`framer-motion`) | Springs, layout and gesture animation | MIT |

## Trees, files and data

| Library | Used for | License |
| --- | --- | --- |
| [Trees](https://trees.software) (`@pierre/trees`) by The Pierre Computer Co. | Every tree: Tree, SchemaTree, and the trees in the Notes, GitHub, Strudel Studio, Interface Builder and T3 blocks | Apache-2.0 |
| [Diffs](https://www.npmjs.com/package/@pierre/diffs) (`@pierre/diffs`) by The Pierre Computer Co. | The code diff in the T3 block's workbench | Apache-2.0 |
| [visual-json](https://github.com/vercel-labs/visual-json) (`@visual-json/react`, `@visual-json/yaml`, `@visual-json/core`) by Vercel Labs | JSON and YAML files in the Notes block | Apache-2.0 |
| [use-fs](https://github.com/TimMikeladze/use-fs) | Folders from your computer and the browser's private file system (OPFS) in the Notes and Reminders blocks | MIT |
| [PGlite](https://pglite.dev) (`@electric-sql/pglite`, `@electric-sql/pglite-tools`) by ElectricSQL | Postgres in the browser for the SQL console, schema tree and storage components | Apache-2.0 |

## Documents and editing

| Library | Used for | License |
| --- | --- | --- |
| [Docstream](https://github.com/BLamy/docstream) and Docstream Editor (`@brett_lamy/docstream`, `@brett_lamy/docstream-editor`) | MarkdownView, MarkdownEditor and the docs site itself. These are BL UI's sibling projects, and they bring the libraries below. | — |
| [Pele](https://pele.run) by Obsidian | Mermaid diagrams, drawn as SVG | MIT |
| [KaTeX](https://katex.org) | Math blocks | MIT |
| [Tiptap](https://tiptap.dev) and [ProseMirror](https://prosemirror.net) | The rich-text editors | MIT |
| [highlight.js](https://highlightjs.org) and [lowlight](https://github.com/wooorm/lowlight) | Code-block highlighting in the docs site's editor setup | BSD-3-Clause, MIT |
| [Lucide](https://lucide.dev) (`lucide-react`) | Icons inside Docstream's own chrome | ISC |
| [yaml](https://eemeli.org/yaml/) | Front matter and YAML parsing | ISC |
| [Acorn](https://github.com/acornjs/acorn) | Parsing Strudel code for its syntax tree | MIT |
| [rrweb](https://github.com/rrweb-io/rrweb) | Replaying recorded sessions in ReplayPreview | MIT |

## GPU libraries

| Library | Used for | License |
| --- | --- | --- |
| [gpu-lexer](https://github.com/shuding/gpu-lexer) by Shu Ding | Syntax highlighting on the GPU | MIT |
| [gpu-time](https://www.npmjs.com/package/gpu-time) by Arik Chakma | Natural-language times in TimeInput | MIT |
| [gpu-cron](https://github.com/jlsajfj/gpu-cron) | Natural language to cron in CronEditor | MIT |
| [gpu-query](https://github.com/safzanpirani/gpu-query) by Safzan Pirani | Natural-language filters. It isn't on npm, so its runtime is vendored with its license in `lib/gpu-query`. | MIT |

## Audio, video and 3D

| Library | Used for | License |
| --- | --- | --- |
| [Strudel](https://strudel.cc) (`@strudel/web`) | Live-coded music in the Strudel player, Strudel Studio and Apple Music blocks | **AGPL-3.0-or-later** |
| [FFmpeg](https://ffmpeg.org), with [libvpx](https://chromium.googlesource.com/webm/libvpx) and [LAME](https://lame.sourceforge.io), built with the [openclaw/ffmpeg-wasm](https://github.com/openclaw/ffmpeg-wasm) scripts | The WebAssembly video tools. It is built from source without `--enable-gpl` or `--enable-nonfree`, and each license file is copied next to the build. | **LGPL-2.1+** (FFmpeg, LAME), BSD (libvpx), MIT (build scripts) |

The STL viewer is Docstream's own WebGL code and has no third-party dependencies.

## Other runtime libraries

| Library | Used for | License |
| --- | --- | --- |
| [cronstrue](https://github.com/bradymholt/cronstrue) | Describing cron expressions in words | MIT |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) by Steve Ruiz | Pressure-sensitive strokes in the PencilKit sketch pad | MIT |
| [agent-wasm](https://github.com/BLamy/agent-wasm) (`@agent-wasm/core`, `@agent-wasm/tailscale-connect`) | The in-browser Node sandbox behind live React demos (Docstream's playground), and the optional Tailscale connection in the Safari block | MIT, BSD-3-Clause |
| [Google Fonts](https://fonts.google.com) | The font picker's catalog. Fonts load from Google's servers under each font's own license, mostly the SIL Open Font License. | Per font |

## Design references

The icon set is drawn for BL UI. Its names follow the SF Symbols vocabulary, and several components and blocks follow Apple's Human Interface Guidelines and apps (Notes, Reminders, Music, Mail, Settings). No Apple artwork or fonts are included. The system font stack only names fonts that are already on the device.

## Building and testing

These run during development and CI. They don't ship in the package.

| Tool | License |
| --- | --- |
| [Vite](https://vite.dev), [Vitest](https://vitest.dev), [esbuild](https://esbuild.github.io) | MIT |
| [Nx](https://nx.dev) | MIT |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 |
| [Playwright](https://playwright.dev) | Apache-2.0 |
| [axe-core](https://github.com/dequelabs/axe-core) by Deque, for the accessibility audit | MPL-2.0 |
| [Storybook](https://storybook.js.org) | MIT |
| [ESLint](https://eslint.org), [typescript-eslint](https://typescript-eslint.io), [Prettier](https://prettier.io), [Knip](https://knip.dev) | MIT, ISC (Knip) |
| [SWC](https://swc.rs) | Apache-2.0 |
| [jsdom](https://github.com/jsdom/jsdom), [jsQR](https://github.com/cozmo/jsQR) | MIT, Apache-2.0 |
