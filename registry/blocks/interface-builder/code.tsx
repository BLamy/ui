/* The Code tab: the storyboard as React, generated as you edit. With an element selected it shows that element's
   JSX and its scene's file; otherwise any file of the app (App.tsx, each scene, the contexts, the runtime). */
import { useMemo, useState } from 'react';
import { SyntaxHighlighting } from '@/components/ui/syntax-highlighting';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { generate, nodeSnippet } from './codegen';
import { ChoiceInput, Help, Section } from './fields';
import type { Doc, Node, Scene } from './model';

export function CodePanel({ doc, scene, node }: { doc: Doc; scene: Scene | null; node: Node | null }) {
  const files = useMemo(() => generate(doc), [doc]);
  const own = scene ? `scenes/${scene.name}.tsx` : 'App.tsx';
  const [picked, setPicked] = useState<string | null>(null);
  const path = picked && files.some((f) => f.path === picked) ? picked : own;
  const file = files.find((f) => f.path === path) ?? files[0];
  const snippet = useMemo(() => (node && scene ? nodeSnippet(doc, scene, node) : null), [doc, scene, node]);
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(files.map((f) => `// ── ${f.path} ──\n${f.code}`).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* no clipboard */ }
  };
  return (
    <>
      {snippet ? (
        <Section title="This element" help="Its JSX">
          <SyntaxHighlighting code={snippet} language="tsx" showCopy maxHeight={260} className="text-caption2" />
        </Section>
      ) : null}
      <Section title="File" action={(
        <PlainButton onPress={() => void copyAll()} className="flex h-6 cursor-pointer items-center gap-1 rounded-md border-0 bg-secondary px-1.5 text-caption2 font-medium outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name={copied ? 'checkmark' : 'copy'} size={12} sw={2.2} /> {copied ? 'Copied' : 'Copy all files'}
        </PlainButton>
      )}>
        <ChoiceInput label="File" value={file.path} options={files.map((f) => ({ id: f.path, label: f.path }))} onChange={setPicked} />
        <SyntaxHighlighting code={file.code} language="tsx" title={file.path} showCopy maxHeight={520} className="text-caption2" />
        <Help>Scenes import the kit by the same paths the registry installs (@/components/ui/…), so the files drop into an app that has them.</Help>
      </Section>
    </>
  );
}
