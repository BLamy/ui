/* GitHub-flavoured writing and reading. <Md> draws a comment or README with GitHub's autolinks (#12, owner/repo#3, @user,
   commit shas), repository-relative links and images resolved, and links that stay in the block when they point at this
   repository. <MarkdownField> is GitHub's comment box: Write / Preview, the formatting toolbar, ⌘↵ to submit. Plain Enter
   always means a new line, so a half-written comment can't be posted by accident. GitHub has no API for uploading
   attachments, so there's no paperclip here: paste a link instead. */
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { TextArea, TextField } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/ui/markdown-view';
import { cn } from '@/lib/utils';
import { Oct, githubMarkdown, type OctName } from './parts';
import { useRepo } from './repo-context';

const API_SAFE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Outside code spans and fences, runs `fn` over the text. */
function outsideCode(md: string, fn: (text: string) => string): string {
  return md.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/).map((part, i) => (i % 2 ? part : fn(part))).join('');
}

/** Turns GitHub's autolinks in Markdown into real links. */
export function autolink(md: string, full: string): string {
  const base = `https://github.com/${full}`;
  return outsideCode(md, (text) => text
    // Don't touch existing links' targets: split them out first.
    .split(/(\[[^\]]*\]\([^)]*\)|<[^>]+>|https?:\/\/\S+)/)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        .replace(/(^|[\s(])([\w.-]+\/[\w.-]+)#(\d+)\b/g, (_, a: string, repo: string, n: string) => `${a}[${repo}#${n}](https://github.com/${repo}/issues/${n})`)
        .replace(/(^|[\s(,:;])#(\d+)\b/g, (_, a: string, n: string) => `${a}[#${n}](${base}/issues/${n})`)
        .replace(/(^|[\s(,:;])GH-(\d+)\b/g, (_, a: string, n: string) => `${a}[GH-${n}](${base}/issues/${n})`)
        .replace(/(^|[\s(,:;])@([A-Za-z0-9][A-Za-z0-9-]*(?:\[bot\])?)/g, (_, a: string, u: string) => `${a}[@${u}](https://github.com/${u})`)
        .replace(/(^|[\s(,:;])([0-9a-f]{7,40})\b/g, (m, a: string, sha: string) => (/[a-f]/.test(sha) && /\d/.test(sha) ? `${a}[${sha.slice(0, 7)}](${base}/commit/${sha})` : m));
    })
    .join(''));
}

/** Points a README's relative links at the repository and its relative images at the raw file. */
export function resolveRelative(md: string, full: string, ref: string, dir: string): string {
  const join = (href: string) => {
    const parts = [...dir.split('/').filter(Boolean)];
    for (const p of href.split('/')) {
      if (p === '..') parts.pop();
      else if (p !== '.' && p) parts.push(p);
    }
    return parts.join('/');
  };
  const fix = (href: string, image: boolean) => {
    if (API_SAFE.test(href)) return href;
    const [path, hash = ''] = href.split('#');
    const absolute = path.startsWith('/') ? path.slice(1) : join(path);
    return image
      ? `https://raw.githubusercontent.com/${full}/${ref}/${absolute}`
      : `https://github.com/${full}/blob/${ref}/${absolute}${hash ? '#' + hash : ''}`;
  };
  return outsideCode(md, (text) => text
    .replace(/(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, bang: string, label: string, href: string, title: string) => `${bang}[${label}](${fix(href, !!bang)}${title})`)
    .replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (_, a: string, href: string, b: string) => `${a}${fix(href, true)}${b}`));
}

/** Markdown as GitHub shows it. `dir` set: a file in the repository, whose relative links resolve from that folder. */
export function Md({ markdown, className, dir, gitRef }: { markdown: string; className?: string; dir?: string; gitRef?: string }) {
  const { source, nav, repo } = useRepo();
  const resolved = dir !== undefined ? resolveRelative(markdown, source.full, gitRef || repo?.branch || 'HEAD', dir) : markdown;
  // `{%` opens a block in the renderer's dialect; on GitHub it's just text.
  const text = autolink(resolved, source.full).replace(/\{%/g, '{\\%');
  const follow = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = (e.target as Element).closest('a');
    const href = a?.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    nav.open(href);
  };
  return (
    // A click on a link inside rendered Markdown; the links themselves stay keyboard-reachable anchors.
    <div onClickCapture={follow}>
      <MarkdownView markdown={text} className={cn(githubMarkdown, 'bg-background text-detail leading-[1.5]', className)} />
    </div>
  );
}

const TOOLS: { icon: OctName; label: string; wrap?: [string, string]; line?: string; key?: string }[] = [
  { icon: 'heading', label: 'Heading', line: '### ' },
  { icon: 'bold', label: 'Bold', wrap: ['**', '**'], key: 'b' },
  { icon: 'italic', label: 'Italic', wrap: ['_', '_'], key: 'i' },
  { icon: 'quote', label: 'Quote', line: '> ' },
  { icon: 'code', label: 'Code', wrap: ['`', '`'], key: 'e' },
  { icon: 'link', label: 'Link', wrap: ['[', '](url)'], key: 'k' },
  { icon: 'list', label: 'Bulleted list', line: '- ' },
  { icon: 'listOrdered', label: 'Numbered list', line: '1. ' },
  { icon: 'tasklist', label: 'Task list', line: '- [ ] ' },
];

export interface MarkdownFieldProps {
  value: string;
  onChange: (v: string) => void;
  /** ⌘↵ / Ctrl↵. */
  onSubmit?: () => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** How tall the box starts, in rows. */
  rows?: number;
  disabled?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function MarkdownField({ value, onChange, onSubmit, label, placeholder = 'Add your comment here…', autoFocus, rows = 6, disabled, footer, className }: MarkdownFieldProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const area = useRef<HTMLTextAreaElement>(null);
  const apply = (t: (typeof TOOLS)[number]) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b);
    let next: string;
    let cursor: [number, number];
    if (t.wrap) {
      next = value.slice(0, a) + t.wrap[0] + selected + t.wrap[1] + value.slice(b);
      cursor = [a + t.wrap[0].length, b + t.wrap[0].length];
    } else {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      const block = value.slice(start, b);
      const prefixed = block.split('\n').map((l, i) => (t.line === '1. ' ? `${i + 1}. ` : t.line) + l).join('\n');
      next = value.slice(0, start) + prefixed + value.slice(b);
      cursor = [start + prefixed.length, start + prefixed.length];
    }
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor[0], cursor[1]); });
  };
  const tabButton = (id: 'write' | 'preview', text: string) => (
    <Button aria-pressed={tab === id} onPress={() => setTab(id)}
      className={cn('h-9 cursor-pointer rounded-t-md border border-b-0 px-3 text-detail outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:h-11',
        tab === id ? 'border-border bg-background font-semibold text-foreground' : 'border-transparent bg-transparent text-muted-foreground')}>
      {text}
    </Button>
  );
  return (
    <div data-slot="markdown-field" className={cn('rounded-md border border-border bg-muted', className)}>
      <div className="flex flex-wrap items-end gap-1 border-b border-border px-2 pt-2">
        {tabButton('write', 'Write')}
        {tabButton('preview', 'Preview')}
        {tab === 'write' ? (
          <div role="toolbar" aria-label="Formatting" className="ml-auto flex flex-wrap items-center pb-1">
            {TOOLS.map((t) => (
              <Button key={t.label} aria-label={t.label} onPress={() => apply(t)} isDisabled={disabled}
                className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:size-9">
                <Oct name={t.icon} size={14} />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="bg-background p-2">
        {tab === 'write' ? (
          <TextField aria-label={label} value={value} onChange={onChange} isDisabled={disabled} className="flex">
            <TextArea ref={area} rows={rows} placeholder={placeholder} autoFocus={autoFocus}
              onKeyDown={(e) => {
                const mod = e.metaKey || e.ctrlKey;
                if (mod && e.key === 'Enter') { e.preventDefault(); onSubmit?.(); return; }
                const tool = mod ? TOOLS.find((t) => t.key === e.key) : undefined;
                if (tool) { e.preventDefault(); apply(tool); }
              }}
              className="box-border block w-full min-w-0 resize-y rounded-md border border-border bg-muted px-2 py-1.5 font-sans text-detail leading-5 text-foreground outline-none select-text placeholder:text-muted-foreground data-focused:border-primary data-focused:bg-background data-focused:ring-1 data-focused:ring-primary" />
          </TextField>
        ) : (
          <div className="min-h-24 rounded-md border border-transparent px-2 py-1.5" aria-label={`${label} preview`}>
            {value.trim() ? <Md markdown={value} /> : <p className="m-0 text-detail text-muted-foreground italic">Nothing to preview</p>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-md border-t border-border bg-muted px-2 py-1.5 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5"><Oct name="book" size={14} />Markdown is supported. ⌘↵ to submit.</span>
        {footer}
      </div>
    </div>
  );
}
