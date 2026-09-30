import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Input, TextField } from 'react-aria-components';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  Icon,
  IconButton,
  MarkdownEditor,
  SplitViewEmpty,
  SplitViewHeader,
  cn,
  useSplitView,
  type MarkdownEditorClassNames,
  type MarkdownEditorHandle,
} from '@brett_lamy/ui';
import type { Doc } from '../lib/data';
import type { CodexState } from '../lib/use-codex';
import { DocOutline, outlineOf } from './doc-outline';

/* The document dressed as a page: 15px body, headings with room above, a blockquote as a callout card, square
   checkboxes. The editor's stylesheet sits in a layer under utilities, so plain classes win. */
const DOC_PARTS: MarkdownEditorClassNames = {
  paragraph: 'text-[15px] leading-[1.65]',
  heading: 'mt-9 mb-2 text-[19px] leading-[1.3] font-semibold',
  list: 'text-[15px] leading-[1.65]',
  blockquote: 'my-4 rounded-xl border-0 bg-secondary px-4 py-3 text-[15px] leading-[1.6] text-foreground not-italic',
  checklist: 'pl-0',
  checklistItem: 'items-start gap-2.5 text-[15px] leading-[1.65] data-[checked=true]:text-muted-foreground data-[checked=true]:line-through',
  checkbox: 'mt-[5px] size-[15px] cursor-pointer accent-primary',
  link: 'text-link underline-offset-2 hover:underline',
  table: 'text-[14px]',
  tableHeader: 'border-border bg-transparent px-3 py-2 font-semibold',
  tableCell: 'border-border px-3 py-2',
};

/** The h2 and h3 blocks of the editor's DOM, in document order. */
const headingEls = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.ProseMirror > :is(h2, h3)')];

/** A document's page: emoji, title, cover, and the editor — with the outline in its margin. Keyed by chat and
    document, so each brings back its own scroll position and section. */
function DocPage({ codex, doc, editorRef, format }: { codex: CodexState; doc: Doc; editorRef: RefObject<MarkdownEditorHandle | null>; format: boolean }) {
  const s = useSplitView();
  const { open, scrollOf, saveScroll } = codex.workspace;
  const scroller = useRef<HTMLDivElement>(null);
  const items = useMemo(() => outlineOf(doc.body), [doc.body]);
  const [active, setActive] = useState(0);
  const typing = useRef(false);

  // The section under the top of the page: the last heading that has scrolled to within 96px of it.
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + 96;
    const at = headingEls(el).filter((h) => h.getBoundingClientRect().top <= top).length - 1;
    setActive(Math.max(0, at));
  };
  // Back where this chat left the document. The editor lays its blocks out a beat after mounting, so try again.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const to = scrollOf(doc.id);
    el.scrollTop = to;
    const t = setTimeout(() => {
      el.scrollTop = to;
      measure();
    }, 120);
    return () => clearTimeout(t);
  }, []);
  useEffect(measure, [items]);

  const pick = (i: number) => {
    const el = scroller.current;
    const h = el && headingEls(el).filter((x) => x.textContent?.trim() === items[i].text)[0];
    if (el && h) el.scrollTo({ top: el.scrollTop + h.getBoundingClientRect().top - el.getBoundingClientRect().top - 24, behavior: 'smooth' });
  };

  return (
    <div className="@container relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={(e) => {
          saveScroll(doc.id, e.currentTarget.scrollTop);
          measure();
        }}
        // A link to another document opens it in this pane instead of navigating.
        onClickCapture={(e) => {
          const href = (e.target as HTMLElement).closest('a')?.getAttribute('href');
          if (!href?.startsWith('#doc-')) return;
          e.preventDefault();
          open(href.slice(5));
        }}
        className="bl-scroll absolute inset-0 overflow-x-hidden overflow-y-auto select-text"
      >
        <div className="mx-auto w-full max-w-[740px] px-6 pt-14 pb-40 @[768px]:px-8">
          <div className="text-[52px] leading-none" aria-hidden="true">
            {doc.emoji}
          </div>
          <TextField aria-label="Title" value={doc.title} onChange={(title) => codex.editDoc(doc.id, { title })} className="mt-4 mb-5 block">
            <Input className="box-border w-full border-0 bg-transparent p-0 text-[34px] leading-[1.15] font-bold tracking-[-.6px] text-foreground [font-family:inherit] outline-none placeholder:text-tertiary-foreground" placeholder="Untitled" />
          </TextField>
          {doc.cover ? <div aria-hidden="true" className="mb-6 h-[120px] rounded-xl bg-(image:--doc-cover)" style={{ '--doc-cover': doc.cover } as React.CSSProperties} /> : null}
          <MarkdownEditor
            ref={editorRef}
            variant="ghost"
            aria-label={doc.title}
            defaultValue={doc.body}
            toolbar={format}
            minHeight={240}
            // Only edits made while the editor has focus count: it normalizes the Markdown on load.
            onFocus={() => (typing.current = true)}
            onBlur={() => (typing.current = false)}
            onValueChange={(body) => typing.current && codex.editDoc(doc.id, { body })}
            className="text-[15px]"
            classNames={DOC_PARTS}
          />
        </div>
      </div>
      {!s.collapsed && <DocOutline title={doc.title} items={items} active={active} onPick={pick} />}
    </div>
  );
}

/** Editor tools: text formatting, checklist, table, and the "/" block menu. */
function DocTools({ editorRef, format, onFormat, disabled }: { editorRef: RefObject<MarkdownEditorHandle | null>; format: boolean; onFormat: () => void; disabled: boolean }) {
  const tool = (label: string, icon: string, onPress: () => void, active?: boolean) => <IconButton name={icon} label={label} size={17} active={active} onPress={disabled ? undefined : onPress} className={cn(disabled && 'opacity-40')} />;
  return (
    <>
      {tool('Format text', 'textformat', onFormat, format)}
      {tool('Checklist', 'checklist', () => editorRef.current?.chain()?.toggleList('taskList', 'taskItem').run())}
      {tool('Table', 'table', () => editorRef.current?.insertMarkdown('| Column | Column |\n| --- | --- |\n|  |  |\n|  |  |'))}
      {tool('Insert block', 'plus', () => editorRef.current?.chain()?.insertContent('/').run())}
    </>
  );
}

/** Switches between the documents open beside this chat. */
function DocSwitcher({ codex }: { codex: CodexState }) {
  const { docs, doc, open } = codex.workspace;
  return (
    <DropdownMenu>
      <Button variant="ghost" aria-label="Documents in this chat" className="h-8 gap-1 rounded-lg px-2 text-muted-foreground data-hovered:bg-secondary">
        <Icon name="doc" size={17} />
        <Icon name="chevron-down" size={12} sw={2.4} />
      </Button>
      <DropdownMenuContent aria-label="Documents" placement="bottom start" selectionMode="single" selectedKeys={doc ? [doc.id] : []} onAction={(k) => open(String(k))}>
        {docs.map((d) => (
          <DropdownMenuItem key={d.id} id={d.id}>
            {d.emoji} {d.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The document pane's content: toolbar over the document open in the current chat's workspace. */
export function DocContent({ codex }: { codex: CodexState }) {
  const s = useSplitView();
  const { doc } = codex.workspace;
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [format, setFormat] = useState(false);
  const tools = <DocTools editorRef={editorRef} format={format} onFormat={() => setFormat((f) => !f)} disabled={!doc} />;
  return (
    <>
      <SplitViewHeader
        title={s.collapsed ? doc?.title : undefined}
        leading={
          <>
            <DocSwitcher codex={codex} />
            {tools}
          </>
        }
        trailing={
          <>
            <IconButton name="clock" label="Version history" size={18} />
            <IconButton name="bubble" label="Comments" size={18} />
            <Button variant="secondary" size="sm" className="ml-1 gap-1.5 rounded-full">
              <Icon name="share" size={15} />
              Share
            </Button>
          </>
        }
      />
      {s.collapsed && doc ? <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1">{tools}</div> : null}
      {doc ? (
        <DocPage key={`${codex.current.id}:${doc.id}`} codex={codex} doc={doc} editorRef={editorRef} format={format} />
      ) : (
        <SplitViewEmpty icon={<Icon name="doc" size={48} sw={1.2} />} title="No document yet" description="Ask dot to write something up and it lands here." />
      )}
    </>
  );
}
