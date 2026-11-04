import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CodeEditor, CodeEditorContent, CodeEditorCopyButton, CodeEditorHeader, CodeEditorTitle, type CodeEditorProps,
} from '@/components/ui/code-editor';
import { Caption, Panel } from '../stories/primitive-frame';

const TS = `import { useEffect, useState } from 'react'

/** Poll a URL every \`ms\` milliseconds. */
export function usePoll<T>(url: string, ms = 5_000): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const tick = async () => {
      const res = await fetch(url)
      if (live && res.ok) setData(await res.json())
    }
    void tick()
    const id = setInterval(tick, ms)
    return () => { live = false; clearInterval(id) }
  }, [url, ms])
  return data
}
`;

const SAMPLES: { language: string; title: string; value: string }[] = [
  {
    language: 'tsx',
    title: 'Greeting.tsx',
    value: `export function Greeting({ name }: { name: string }) {
  return <p className="greeting">Hello, {name}!</p>
}`,
  },
  {
    language: 'json',
    title: 'package.json',
    value: `{
  "name": "@acme/queue",
  "version": "3.3.0",
  "private": false,
  "scripts": { "test": "vitest run" }
}`,
  },
  {
    language: 'css',
    title: 'button.css',
    value: `.button {
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--primary);
}
.button:hover { opacity: 0.9; }`,
  },
  {
    language: 'bash',
    title: 'install.sh',
    value: `# install and build
pnpm add @brett_lamy/ui
pnpm nx run-many -t build --parallel=3
echo "done in $SECONDS s"`,
  },
  {
    language: 'python',
    title: 'retry.py',
    value: `def backoff(attempt: int, base: float = 1.0) -> float:
    """Exponential backoff in seconds."""
    return min(base * 2 ** (attempt - 1), 60.0)`,
  },
  {
    language: 'md',
    title: 'README.md',
    value: `# Queue

Durable jobs for **Postgres**. See [the docs](https://example.com).

- retries with \`jitter\`
- cron schedules`,
  },
];

/* CodeEditor as a snippet: read-only, with every character in the page. These stories are the proof that it looks exactly as it
   always did: their baselines are SyntaxHighlighting's. */

const meta: Meta<CodeEditorProps> = {
  title: 'Organisms/CodeEditor/Read only',
  component: CodeEditor,
  args: { readOnly: true, value: TS, language: 'ts', title: 'use-poll.ts', showCopy: true, lineNumbers: true, variant: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'ghost', 'inline'] },
    wrap: { control: 'boolean' },
    engine: { control: 'inline-radio', options: ['auto', 'gpu', 'fallback'] },
  },
  decorators: [(Story, { parameters }) => <Panel dark={!!parameters.dark} w={640}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<CodeEditorProps>;

export const Default: Story = {};

export const Languages: Story = {
  render: () => (
    <div className="grid gap-3">
      {SAMPLES.map((s) => <CodeEditor readOnly key={s.title} value={s.value} language={s.language} title={s.title} />)}
    </div>
  ),
};

export const HighlightedLines: Story = {
  args: { highlightLines: [4, [7, 11]], title: 'use-poll.ts', showCopy: false },
};

export const StartLine: Story = {
  args: { value: TS.split('\n').slice(6, 12).join('\n'), startLine: 7, highlightLines: ['9-10'], title: 'use-poll.ts · L7–12', showCopy: false },
};

export const Diff: Story = {
  args: {
    title: 'retry.ts',
    showCopy: false,
    value: `export function delay(attempt: number) {
  return Math.min(base * 2 ** attempt, max)
  const backoff = Math.min(base * 2 ** attempt, max)
  return applyJitter(backoff, jitter, random)
}`,
    addedLines: [3, 4],
    removedLines: [2],
  },
};

export const Wrap: Story = {
  args: {
    title: 'long-lines.ts',
    wrap: true,
    value: `const message = 'Soft-wrapped lines keep their line number on the first row and continue under the code column, instead of scrolling sideways.'
export const url = 'https://example.com/a/very/long/path/that/keeps/going/and/going?with=query&and=more&parameters=true'`,
  },
};

export const GhostAndInline: Story = {
  render: () => (
    <div className="grid gap-4 text-[15px] leading-6 text-foreground">
      <p className="m-0">
        Call <CodeEditor readOnly variant="inline" value="usePoll<User>('/api/me', 10_000)" language="ts" /> inside a component, or read
        a flag with <CodeEditor readOnly variant="inline" value='process.env.FEATURE === "on"' language="js" />.
      </p>
      <Caption>Ghost</Caption>
      <CodeEditor readOnly variant="ghost" value={SAMPLES[0].value} language="tsx" />
    </div>
  ),
};

/** A 2,000-line file: it scrolls inside `maxHeight`, and renders in off-screen-skippable blocks. */
const LONG = Array.from({ length: 2000 }, (_, i) =>
  i % 10 === 0 ? `// ── section ${i / 10 + 1} ──` : `export const value${i} = compute(${i}, "row-${i}") // ${i % 3 ? 'ok' : 'retry'}`,
).join('\n');

export const LongFile: Story = {
  args: { value: LONG, language: 'ts', title: 'generated.ts', maxHeight: 360, highlightLines: [3] },
};

export const Composed: Story = {
  render: () => (
    <CodeEditor readOnly value={SAMPLES[1].value} language="json">
      <CodeEditorHeader>
        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">JSON</span>
        <CodeEditorTitle>package.json</CodeEditorTitle>
        <CodeEditorCopyButton />
      </CodeEditorHeader>
      <CodeEditorContent lineNumbers highlightLines={[3]} />
    </CodeEditor>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: () => (
    <div className="grid gap-3">
      <CodeEditor readOnly value={TS} language="ts" title="use-poll.ts" showCopy lineNumbers highlightLines={[4]} />
      <CodeEditor readOnly value={SAMPLES[2].value} language="css" />
      <p className="m-0 text-[15px] text-foreground">
        Inline: <CodeEditor readOnly variant="inline" value="const ok = await retry(job, { attempts: 3 })" language="ts" />
      </p>
    </div>
  ),
};

/** `engine="fallback"`: the small CPU labeller used when WebGPU is unavailable (`data-highlighter="fallback"`). */
export const ForcedFallback: Story = {
  render: () => (
    <div className="grid gap-3">
      <CodeEditor readOnly value={TS} language="ts" title="use-poll.ts · fallback" lineNumbers engine="fallback" />
      <CodeEditor readOnly value={SAMPLES[4].value} language="python" title="retry.py · fallback" engine="fallback" />
    </div>
  ),
};
