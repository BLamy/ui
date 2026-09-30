# Working with LLMs

Point a coding agent at BL UI and it can set up a project, pick the right parts and build screens without guessing at the API. Copy a prompt below into Claude Code, Codex, Cursor or any agent that can run shell commands and read URLs.

## What the agent can read

Everything on this site is also published as plain Markdown, so an agent doesn't have to scrape HTML:

| Resource | URL |
| --- | --- |
| Index of every page | `https://blamy.github.io/ui/llms.txt` |
| A single page | `https://blamy.github.io/ui/md/<page>.md` (for example `md/split-view.md`) |
| Every registry item | `https://blamy.github.io/ui/r/registry.json` |
| One registry item | `https://blamy.github.io/ui/r/<item>.json` |

Each page's **Copy page** action exports the same Markdown plus its demo files, which is the quickest way to hand a single component to a chat that can't browse.

{% tabs title="Prompts" sync="llm-setup" %}
{% tab title="New project" %}
Replace the text in `[brackets]` before you send it.

```text
Create a new app with BL UI (@brett_lamy/ui), an iOS-flavored React component library built on React Aria Components, Tailwind CSS v4 and shadcn conventions.

The app: [describe what you are building, its main screens and who it is for].

Setup:
1. Scaffold with shadcn's React Aria base: npx shadcn@latest create --name [app-name] --template vite --base aria
2. From the new project's folder add the BL UI base item: npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json
3. [Keep or drop this step] Add the iOS theme: npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json (it overwrites the shadcn palette variables; skip it to keep the preset's look).

Before writing any UI, read https://blamy.github.io/ui/llms.txt and then the Markdown pages for the parts you plan to use (https://blamy.github.io/ui/md/<page>.md). Pick parts from those pages instead of building your own, and use the registry blocks (https://blamy.github.io/ui/r/registry.json) as reference for whole-app layouts.

Rules:
- Add components with npx shadcn@latest add https://blamy.github.io/ui/r/<item>.json. They land in src/components/ui/<name>.tsx and can be edited. Import them through the @/ alias.
- Color comes from shadcn's CSS variables: bg-background, text-foreground, text-muted-foreground, border-border, bg-secondary, bg-primary, text-destructive and so on. Do not hard-code hex values or add a second palette.
- Do not invent props or exports. If a part's page doesn't show it, check the installed file first.
- Use React Aria patterns (onPress rather than onClick on BL UI controls) and keep everything usable by keyboard.
- Build one screen at a time, run the type check and npm run build after each, and fix errors before moving on.

When you finish, list the BL UI parts you used and anything you had to build by hand.
```
{% endtab %}

{% tab title="Existing project" %}
Replace the text in `[brackets]` before you send it.

```text
Add BL UI (@brett_lamy/ui) to this existing React app and use it for [the screens or features you want to build]. BL UI is an iOS-flavored component library built on React Aria Components, Tailwind CSS v4 and shadcn conventions.

First, inspect the project and tell me what you found before changing anything: the framework (Vite, Next.js, React Router, ...), the React version (18 and 19 are supported), whether Tailwind v4 is installed, whether an @/ import alias exists, whether components.json (shadcn) exists and which base it uses, and how the app currently styles and themes itself.

Then set it up, doing only the steps that are missing:
1. Tailwind CSS v4 and an @/ alias. For frameworks other than Vite follow https://ui.shadcn.com/docs/installation.
2. shadcn, if there is no components.json: npx shadcn@latest init --base aria. An existing Radix or Base UI setup can stay; BL UI doesn't depend on the base.
3. The BL UI base item: npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json
4. Do NOT add the iOS theme (bl-theme) unless I ask. It overwrites the app's palette variables. Without it, BL UI wears the app's existing shadcn theme.

Before writing any UI, read https://blamy.github.io/ui/llms.txt and then the Markdown pages for the parts you plan to use (https://blamy.github.io/ui/md/<page>.md).

Rules:
- Make the smallest change that works. Don't restyle, rename or move existing code I didn't ask about, and don't upgrade unrelated dependencies.
- Add components one at a time with npx shadcn@latest add https://blamy.github.io/ui/r/<item>.json and import them through the alias. Reuse the app's existing data, routing and state.
- Color comes from shadcn's CSS variables (bg-background, text-foreground, text-muted-foreground, border-border, bg-primary, ...). Map anything the app hard-codes onto those instead of adding new colors.
- Do not invent props or exports. If a part's page doesn't show it, check the installed file first.
- If the app already has its own component library, tell me where BL UI overlaps it and suggest which to keep instead of replacing it.
- After each change run the type check and the build, and fix errors before moving on.

When you finish, summarize what you installed, what you changed and how to run it.
```
{% endtab %}
{% endtabs %}

## Tips

- Name the parts you want. "Use `SplitView` and `NavigationStack`" gets better results than "make it look like iOS".
- For a whole-app starting point, point the agent at a registry block (`apple-mail`, `apple-notes`, `discord-clone`, ...) and ask it to adapt that block to your data.
- When the agent gets a prop wrong, paste the relevant page's **Copy page** export into the chat. It carries the API tables and working demo code together.
