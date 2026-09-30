# Blocks

Whole apps composed from BL UI parts, in the spirit of shadcn blocks. A block is a few readable files that import the library's parts by alias (`@/components/ui/…`) plus components of its own — the complex, product-specific ones (a terminal dock, a chat shell, a tile map) live in the block, not in the library. Preview it at any width, read the code, and add it to your app with the shadcn CLI: the block's files land in `components/blocks/<name>/`, and only the library parts it imports are copied with it.

{% demo src="blocks/discord-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/discord-clone.json{% endcommand %}

{% demo src="blocks/github-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/github-clone.json{% endcommand %}

{% demo src="blocks/t3-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/t3-clone.json{% endcommand %}

{% demo src="blocks/codex-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/codex-clone.json{% endcommand %}

{% demo src="blocks/alfred-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/alfred-clone.json{% endcommand %}

{% demo src="blocks/apple-reminders" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-reminders.json{% endcommand %}

{% demo src="blocks/apple-settings" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-settings.json{% endcommand %}

{% demo src="blocks/apple-mail" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-mail.json{% endcommand %}

{% demo src="blocks/apple-notes" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-notes.json{% endcommand %}

{% demo src="blocks/apple-passwords" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-passwords.json{% endcommand %}

{% demo src="blocks/apple-music" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-music.json{% endcommand %}

{% demo src="blocks/loop-qa" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/loop-qa.json{% endcommand %}

{% hint style="info" %}
**Blocks land in `components/blocks/<name>/`.** Render the default export from `page.tsx` in a sized container — blocks fill their parent and adapt to its width, not the window's.
{% endhint %}

{% demo src="blocks/map-chat" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/map-chat.json{% endcommand %}

{% demo src="blocks/delivery-tracking" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/delivery-tracking.json{% endcommand %}

{% demo src="blocks/pencilkit-sketch" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/pencilkit-sketch.json{% endcommand %}

{% demo src="blocks/split-view-demos" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/split-view-demos.json{% endcommand %}

## Anatomy of a block

A block is a folder in `registry/blocks/<slug>/`. Adding it copies the folder to `components/blocks/<slug>/` in your app, plus the library parts it imports and no others.

```text
components/blocks/discord-clone/
  page.tsx              the default export: the whole app, sized by its parent
  data.ts               sample data you replace with your own
  channel-message.tsx   parts of this product
  thread-view.tsx
  chat-theme.css        the block's theme scope
  components/
    chat-shell.tsx      block-local components (the shell is this product's, not the library's)
    message.tsx         with its own cva recipe, messageVariants
    channel-list.tsx
    …
```

`meta.json` describes it to the registry:

```json
{
  "name": "discord-clone",
  "title": "Discord clone",
  "description": "A team chat in Discord's shape: …",
  "categories": ["chat", "application"],
  "files": ["page.tsx", "channel-message.tsx", "components/message.tsx", "chat-theme.css", "…"],
  "dependencies": ["class-variance-authority", "react-aria-components"]
}
```

`files` are the files copied. `dependencies` are the npm packages the block itself imports beyond React; the library parts it needs come from its imports.

**What goes in a block, and what in the library.** The library holds parts that work in any product: buttons, lists, split views, the Composer, the theme. A block holds what only makes sense in one product: a Discord-style `ChatShell`, the T3-style `WorkbenchShell`, terminal and surface panels, a `ModelPicker`, a `TileMap` with its geography, sample data, and the palette that product wears. If a piece would be useful in a second, unrelated product, it belongs in the library; if it names a product or a domain, it belongs in the block. Block-local components can have block-local `cva` recipes ([Styling and variants](https://blamy.github.io/ui/#/styling)).

**Imports.** A block imports `react`, library parts by alias (`@/components/ui/<x>`, `@/lib/<x>`), its own files, and the packages listed in `dependencies`, and nothing else. The registry build fails on anything more, which is how a block stays copyable. Never import from `@brett_lamy/ui`.

**Adapting one.** You own the copy. Replace `data.ts` with your data source, delete the parts you do not want, change a recipe. Blocks that another page wants to reuse export their parts: the docs import `TileMap` from `@/components/blocks/map-chat/tile-map` and `ModelPicker` from `@/components/blocks/t3-clone/components/workbench/model-picker`.

See [How the registry works](https://blamy.github.io/ui/#/registry) for how a block becomes an item.
