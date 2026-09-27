# Blocks

Whole apps composed from BL UI parts, in the spirit of shadcn blocks. Each block is a few readable files that import only from `@brett_lamy/ui` — preview it at any width, read the code, and add it to your app with the shadcn CLI.

{% demo src="blocks/discord-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/discord-clone.json{% endcommand %}

{% demo src="blocks/github-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/github-clone.json{% endcommand %}

{% demo src="blocks/t3-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/t3-clone.json{% endcommand %}

{% hint style="info" %}
**Blocks land in `components/blocks/<name>/`.** Render the default export from `page.tsx` in a sized container — blocks fill their parent and adapt to its width, not the window's.
{% endhint %}
