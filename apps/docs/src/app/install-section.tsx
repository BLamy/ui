/* The Installation section at the top of each component page, from the page's registry entry
   (registry/components/<name>.json): the npm package or the shadcn CLI, each with its import line. */
import { useState } from 'react';
import type { ComponentEntry } from '@brett_lamy/registry/components/types';
import { CodeBlock, CommandBlock, PillTabs } from './copy';
import { itemUrl } from './registry';

const METHODS = [
  { id: 'npm', label: 'npm' },
  { id: 'cli', label: 'shadcn CLI' },
] as const;
type Method = (typeof METHODS)[number]['id'];

/** The names a page's import line shows: the entry's `imports`, else its first few components. */
function importNames(entry: ComponentEntry, max = 4) {
  if (entry.imports?.length) return entry.imports;
  const parts = entry.exports.filter((e) => /^[A-Z][a-z]/.test(e));
  return (parts.length ? parts : entry.exports).slice(0, max);
}

/** `import { … } from '…'`, on one line when it fits, else packed onto indented lines. */
export function importLine(names: string[], from: string) {
  const one = `import { ${names.join(', ')} } from '${from}'`;
  if (one.length <= 72) return one;
  const lines: string[] = [];
  let cur = '';
  for (const n of names) {
    if (cur && (cur + ' ' + n + ',').length > 64) { lines.push(cur); cur = ''; }
    cur += (cur ? ' ' : '') + n + ',';
  }
  lines.push(cur);
  return `import {\n${lines.map((l) => '  ' + l).join('\n')}\n} from '${from}'`;
}

export interface InstallText {
  npm: { packages: string[]; importLine: string };
  cli: { command: string; importLine: string };
}

/** The same instructions as text (Copy page / page Markdown). */
export function installText(entry: ComponentEntry): InstallText {
  const from = entry.from || '@brett_lamy/ui';
  const names = importNames(entry);
  return {
    npm: { packages: [...new Set(['@brett_lamy/ui', from])], importLine: importLine(names, from) },
    cli: { command: `shadcn@latest add ${itemUrl(entry.name)}`, importLine: importLine(names, `@/components/ui/${entry.name}`) },
  };
}

export function installMarkdown(entry: ComponentEntry): string {
  const t = installText(entry);
  return [
    '## Installation',
    '',
    '**npm**',
    '',
    '```sh',
    `pnpm add ${t.npm.packages.join(' ')}`,
    '```',
    '',
    '```tsx',
    `import '@brett_lamy/ui/styles.css' // once, at your app's entry`,
    t.npm.importLine,
    '```',
    '',
    '**shadcn CLI**',
    '',
    '```sh',
    `npx ${t.cli.command}`,
    '```',
    '',
    '```tsx',
    t.cli.importLine,
    '```',
  ].join('\n');
}

export function InstallSection({ entry }: { entry: ComponentEntry }) {
  const [method, setMethod] = useState<Method>('npm');
  const t = installText(entry);
  return (
    <section className="dk-install" aria-labelledby="dk-install-h">
      <div className="dk-install-head">
        <h2 id="dk-install-h" className="dk-h2">Installation</h2>
        <PillTabs id="install-method" label="Installation method" tabs={METHODS} value={method} onChange={setMethod} />
      </div>
      {method === 'npm' ? (
        <div className="dk-install-body" key="npm">
          <CommandBlock id="install-npm" cmd={{ add: t.npm.packages }} />
          <p className="dk-install-note">Import the stylesheet once at your app's entry, then the parts from the package root:</p>
          <CodeBlock code={`import '@brett_lamy/ui/styles.css'\n\n${t.npm.importLine}`} />
        </div>
      ) : (
        <div className="dk-install-body" key="cli">
          <CommandBlock id="install-cli" cmd={{ dlx: t.cli.command }} />
          <p className="dk-install-note">
            Adds <code>@/components/ui/{entry.name}.tsx</code>, installs <code>@brett_lamy/ui</code>, and wires its stylesheet and
            tokens into your CSS. Import from your alias:
          </p>
          <CodeBlock code={t.cli.importLine} />
        </div>
      )}
    </section>
  );
}
