/* The two ways to install, side by side and equal: the npm package, or source copied by the shadcn CLI. The commands
   and the code are Markdown drawn by MarkdownView, as on every docs page: `{% command %}` is docstream's command box
   (it rewrites the command for pnpm, yarn and bun, and copies it), and the fences are highlighted by the kit's lexer.
   What they say is in ./install-data, which landing.test.ts holds to the code. */
import { useId, type ReactNode } from 'react';
import { MarkdownView } from '@/components/ui/markdown-view';
import { INSTALL_COMMAND, PACKAGE, SAMPLE_NPM, SAMPLE_SOURCE, SOURCE_ITEM, SOURCE_LIBRARY, SOURCE_LIBRARY_ITEM, addCommand } from './install-data';

const command = (line: string) => `{% command %}${line}{% endcommand %}`;
const fence = (code: string) => `\`\`\`tsx\n${code}\n\`\`\``;

/** One way to install: what it is on the leading side, what to run and write on the other. */
function Way({ title, children, lede }: { title: string; lede: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-x-10 gap-y-4 border-t border-border pt-6 @4xl/page:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <h3 id={id} className="m-0 text-body font-semibold">{title}</h3>
        <p className="m-0 text-subhead text-pretty text-muted-foreground">{lede}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** A line of text over a command or a code sample. */
function Step({ label, markdown }: { label: string; markdown: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="m-0 text-footnote font-medium text-muted-foreground">{label}</p>
      <MarkdownView markdown={markdown} />
    </div>
  );
}

export function InstallWays() {
  return (
    <div className="flex flex-col gap-8">
      <Way
        title="Install the package"
        lede={<>One dependency. Every library is an entry of <code>{PACKAGE}</code>, UI SDK included, and a bundle carries only the entries the app imports.</>}
      >
        <Step label="Add the package" markdown={command(INSTALL_COMMAND)} />
        <Step label="Import the stylesheet once, then parts from the root or from a library's entry" markdown={fence(SAMPLE_NPM)} />
      </Way>
      <Way
        title="Copy the source"
        lede="The shadcn CLI copies a component into your project, with the parts it is built from and the tokens it needs. No runtime package, and the files are yours to edit."
      >
        <Step label="Copy one component" markdown={command(addCommand(SOURCE_ITEM))} />
        {SOURCE_LIBRARY && SOURCE_LIBRARY_ITEM ? <Step label={`Or a whole library, here ${SOURCE_LIBRARY.name}`} markdown={command(addCommand(SOURCE_LIBRARY_ITEM))} /> : null}
        <Step label="Import from your own alias" markdown={fence(SAMPLE_SOURCE)} />
      </Way>
    </div>
  );
}
