import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  SyntaxHighlighting, SyntaxHighlightingContent, SyntaxHighlightingCopyButton, SyntaxHighlightingHeader, SyntaxHighlightingTitle,
} from '@/components/ui/syntax-highlighting';
import { Caption, Panel } from '../stories/primitive-frame';

/* The old names still work. These keep their old baselines, so the aliases can't drift from what they were. The real stories
   are CodeEditor's. */

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

const JSON_SOURCE = `{
  "name": "@acme/queue",
  "version": "3.3.0",
  "private": false,
  "scripts": { "test": "vitest run" }
}`;

const GREETING = `export function Greeting({ name }: { name: string }) {
  return <p className="greeting">Hello, {name}!</p>
}`;

const meta: Meta<typeof SyntaxHighlighting> = {
  title: 'Atoms/SyntaxHighlighting',
  component: SyntaxHighlighting,
  args: { code: TS, language: 'ts', title: 'use-poll.ts', showCopy: true, lineNumbers: true, variant: 'default' },
  decorators: [(Story, { parameters }) => <Panel dark={!!parameters.dark} w={640}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof SyntaxHighlighting>;

export const Default: Story = {};

export const GhostAndInline: Story = {
  render: () => (
    <div className="grid gap-4 text-[15px] leading-6 text-foreground">
      <p className="m-0">
        Call <SyntaxHighlighting variant="inline" code="usePoll<User>('/api/me', 10_000)" language="ts" /> inside a component, or read
        a flag with <SyntaxHighlighting variant="inline" code='process.env.FEATURE === "on"' language="js" />.
      </p>
      <Caption>Ghost</Caption>
      <SyntaxHighlighting variant="ghost" code={GREETING} language="tsx" />
    </div>
  ),
};

export const Composed: Story = {
  render: () => (
    <SyntaxHighlighting code={JSON_SOURCE} language="json">
      <SyntaxHighlightingHeader>
        <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">JSON</span>
        <SyntaxHighlightingTitle>package.json</SyntaxHighlightingTitle>
        <SyntaxHighlightingCopyButton />
      </SyntaxHighlightingHeader>
      <SyntaxHighlightingContent lineNumbers highlightLines={[3]} />
    </SyntaxHighlighting>
  ),
};
