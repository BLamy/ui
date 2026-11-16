# Working with LLMs

Point a coding agent at BL UI and it can set up a project, pick the right parts and build screens without guessing at the API. BL UI installs as source (the shadcn registry copies files into your app), which suits agents: the code they need to read is in your repo. Copy a prompt below into Claude Code, Codex, Cursor or any agent that can run shell commands and read URLs.

## What the agent can read

Everything on this site is also published as plain Markdown, so an agent doesn't have to scrape HTML:

| Resource | URL |
| --- | --- |
| Index of every page (`llms.txt`) | `https://blamy.github.io/ui/llms.txt` |
| A single page | `https://blamy.github.io/ui/md/<page>.md` (for example `md/split-view.md`) |
| Every cva recipe and its options | `https://blamy.github.io/ui/md/variants.md` |
| Every registry item (parts and blocks) | `https://blamy.github.io/ui/r/registry.json` |
| One registry item | `https://blamy.github.io/ui/r/<item>.json` |
| How to move a 5.x or docstream 2.0.1 app | `https://blamy.github.io/ui/md/migrating-to-6.md` |

Each page's **Copy page** action exports the same Markdown plus its demo files, which is the quickest way to hand a single component to a chat that can't browse.

{% tabs title="Prompts" sync="llm-setup" %}
{% tab title="New project" %}
Replace the text in `[brackets]` before you send it.

```text
Create a new app with BL UI, an iOS-flavored React component library built on UI SDK, Tailwind CSS v4 and shadcn conventions. It is consumed as a shadcn registry: the components are copied into the app as source.

The app: [describe what you are building, its main screens and who it is for].

Setup:
1. Scaffold a Vite + React 19 + Tailwind v4 app with shadcn: npx shadcn@latest create --name [app-name] --template vite. Any base and preset will do: BL UI's parts are UI SDK parts and don't use shadcn's base, so don't add the base's own components for things BL UI ships.
2. From the new project's folder install UI SDK, our fork under upstream's names, both at the same version: npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1
3. Put `@layer ui-sdk;` on the first line of the global CSS, above `@import "tailwindcss"`, so Tailwind's utilities win over UI SDK's runtime CSS.
4. Add the BL UI base item: npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json (it writes BL UI's tokens into the CSS and installs no package).
5. [Keep or drop this step] Add the iOS theme: npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json (it overwrites the shadcn palette variables; skip it to keep the preset's look).

Before writing any UI, read https://blamy.github.io/ui/llms.txt and then the Markdown pages for the parts you plan to use (https://blamy.github.io/ui/md/<page>.md). Pick parts from those pages instead of building your own, and use the registry blocks (https://blamy.github.io/ui/r/registry.json, type registry:block) as reference for whole-app layouts.

Rules:
- Add parts one at a time with npx shadcn@latest add https://blamy.github.io/ui/r/<item>.json. The source is copied into src/components/ui/<name>.tsx (libraries into src/lib/) and can be edited; only the items a part imports are copied with it. Import through the @/ alias, never from @brett_lamy/ui. The one exception is already in the copied files: parts built on docstream (MarkdownView, MarkdownEditor, the Composer, ReplayPreview…) import @brett_lamy/ui/docstream/..., and adding them installs @brett_lamy/ui for that; leave those imports as they are. Blocks land in src/components/blocks/<name>/.
- Color, radius, type and shadows come from theme utilities: bg-background, text-foreground, text-muted-foreground, border-border, bg-primary, rounded-ctl, text-footnote, shadow-hairline. Do not hard-code hex values, rgba() or arbitrary radius and text sizes, and do not add a second palette.
- Every component exports a cva recipe (buttonVariants, badgeVariants, ...). Reuse it for links and custom elements, and change a default by editing the copied file, not by wrapping it.
- Do not invent props or exports. If a part's page doesn't show it, check the installed file first.
- Use UI SDK conventions (`onClick`, `disabled`, `open`/`onOpenChange`, `value`/`onValueChange(value, details)`) and keep everything usable by keyboard.
- Build one screen at a time, run the type check and npm run build after each, and fix errors before moving on.

When you finish, list the BL UI parts you used and anything you had to build by hand.
```
{% endtab %}

{% tab title="Existing project" %}
Replace the text in `[brackets]` before you send it.

```text
Add BL UI to this existing React app and use it for [the screens or features you want to build]. BL UI is an iOS-flavored component library built on UI SDK, Tailwind CSS v4 and shadcn conventions, consumed as a shadcn registry (components are copied into the app as source).

First, inspect the project and tell me what you found before changing anything: the framework (Vite, Next.js, React Router, ...), the React version (BL UI needs React 19), whether Tailwind v4 is installed, whether an @/ import alias exists, whether components.json (shadcn) exists and which base it uses, and how the app currently styles and themes itself.

Then set it up, doing only the steps that are missing:
1. Tailwind CSS v4 and an @/ alias. For frameworks other than Vite follow https://ui.shadcn.com/docs/installation. In Next.js, components.json needs "rsc": true so the copied modules keep their 'use client' directives.
2. shadcn, if there is no components.json: npx shadcn@latest init. An existing Radix, Base UI or React Aria setup can stay; BL UI's parts are built on UI SDK and don't depend on the base.
3. UI SDK, our fork under upstream's names, both at the same version: npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1. Then put `@layer ui-sdk;` at the very top of the global CSS, above `@import "tailwindcss"`.
4. The BL UI base item: npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json (tokens and framework CSS only, no package).
5. Do NOT add the iOS theme (bl-theme) unless I ask. It overwrites the app's palette variables. Without it, BL UI wears the app's existing shadcn theme.

Warning: BL UI's items depend on BL UI's own button and utils, so adding a part can overwrite components/ui/button.tsx and lib/utils.ts. Before the first add, commit or stash, tell me if either file has local changes, and after each add review the diff of those two files. Do not answer yes to an overwrite without telling me.

Before writing any UI, read https://blamy.github.io/ui/llms.txt and then the Markdown pages for the parts you plan to use (https://blamy.github.io/ui/md/<page>.md).

Rules:
- Make the smallest change that works. Don't restyle, rename or move existing code I didn't ask about, and don't upgrade unrelated dependencies.
- Add parts one at a time with npx shadcn@latest add https://blamy.github.io/ui/r/<item>.json and import them through the alias (never from @brett_lamy/ui; the copied parts built on docstream keep their own @brett_lamy/ui/docstream/... imports, and adding them installs @brett_lamy/ui). Reuse the app's existing data, routing and state.
- Color comes from shadcn's CSS variables through utilities (bg-background, text-foreground, text-muted-foreground, border-border, bg-primary, ...). Map anything the app hard-codes onto those instead of adding new colors.
- Do not invent props or exports. If a part's page doesn't show it, check the installed file first.
- If the app already has its own component library, tell me where BL UI overlaps it and suggest which to keep instead of replacing it.
- After each change run the type check and the build, and fix errors before moving on.

When you finish, summarize what you installed, what you changed and how to run it.
```
{% endtab %}
{% endtabs %}

## Tips

- Name the parts you want. "Use `SplitView` and `NavigationStack`" gets better results than "make it look like iOS".
- For a whole-app starting point, point the agent at a registry block (`apple-mail`, `apple-notes`, `discord-clone`, ...) and ask it to add that block and adapt it to your data. The block's files are copied into your repo, so the agent edits them like any other code.
- When the agent gets a prop wrong, paste the relevant page's **Copy page** export into the chat. It carries the API tables and working demo code together.
