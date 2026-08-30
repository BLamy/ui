# @touchkit/beautiful

AI-native React interface primitives in TouchKit's dark visual language.

## Install

```sh
pnpm add @touchkit/beautiful @touchkit/ui react react-dom
```

`DiffTable` is a compatibility adapter over Pierre's syntax-highlighted diff renderer. To use the renderer directly:

```sh
pnpm add @pierre/diffs
```

```tsx
import { MultiFileDiff } from '@pierre/diffs/react';

export function Review({ before, after }: { before: string; after: string }) {
  return (
    <MultiFileDiff
      oldFile={{ name: 'menu.csv', contents: before }}
      newFile={{ name: 'menu.csv', contents: after }}
      options={{ diffStyle: 'unified', themeType: 'dark' }}
    />
  );
}
```

See the [@pierre/diffs documentation](https://diffs.com/docs) for split views, annotations, selection, and virtualization.

## Workspace development

```sh
pnpm nx build @touchkit/beautiful
pnpm nx lint @touchkit/beautiful
```
