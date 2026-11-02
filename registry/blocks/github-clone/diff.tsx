/* Files changed: parses `@@` hunks into rows with old and new line numbers, unified or split, with syntax colors inside
   the +/- backgrounds. Review threads sit under the line they're on; the + on a line opens a comment on that line (or a
   range, shift-clicking a second line). Used by pull requests, single commits and compare; only a pull request passes
   `review`, so only there can lines be commented on. */
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SyntaxTokens, useSyntaxTokens } from '@/components/ui/syntax-highlighting';
import { languageFromPath, type SyntaxToken } from '@/lib/syntax';
import { cn } from '@/lib/utils';
import type { DiffFile, FileNode, NewReviewComment, ReviewThread } from './data';
import { GhLink } from './links';
import { MarkdownField } from './markdown';
import { Box, DiffStat, FileTree, Oct, ghButton } from './parts';
import { ActionError, useAction, useRepo } from './repo-context';

export type DiffRow = { t: 'hunk' | 'ctx' | 'add' | 'del' | 'note'; text: string; o?: number; n?: number };

export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let o = 0;
  let n = 0;
  for (const line of patch.split('\n')) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    if (h) {
      o = +h[1];
      n = +h[2];
      rows.push({ t: 'hunk', text: line });
    } else if (line.startsWith('\\')) rows.push({ t: 'note', text: line.slice(2) });
    else if (line[0] === '+') rows.push({ t: 'add', text: line.slice(1), n: n++ });
    else if (line[0] === '-') rows.push({ t: 'del', text: line.slice(1), o: o++ });
    else rows.push({ t: 'ctx', text: line.slice(1), o: o++, n: n++ });
  }
  return rows;
}

const ROW_BG = { add: 'bg-(--gh-add)', del: 'bg-(--gh-del)', hunk: 'bg-(--gh-hunk)', ctx: '', note: '' };
const NUM_BG = { add: 'bg-(--gh-add-num)', del: 'bg-(--gh-del-num)', hunk: 'bg-(--gh-hunk)', ctx: '', note: '' };
const STATUS: Record<string, [string, string]> = {
  added: ['Added', 'text-(--gh-open) border-(--gh-open)'], removed: ['Removed', 'text-(--gh-closed) border-(--gh-closed)'], renamed: ['Renamed', 'text-(--gh-attention) border-(--gh-attention)'], copied: ['Copied', 'text-muted-foreground border-border'],
};

export interface DiffReview {
  threads: ReviewThread[];
  /** Whether a pending review is under way: the composer's main action adds to it. */
  pending: boolean;
  canComment: boolean;
  addComment: (c: NewReviewComment, mode: 'single' | 'review') => Promise<void>;
  renderThread: (t: ReviewThread) => ReactNode;
}

export interface DiffViewProps {
  file: DiffFile;
  split?: boolean;
  viewed?: boolean;
  onViewed?: (v: boolean) => void;
  review?: DiffReview;
  /** A commit or ref to open the file at. */
  browseRef?: string;
}

type Selection = { side: 'LEFT' | 'RIGHT'; line: number; start?: number };

export function DiffView({ file, split, viewed, onViewed, review, browseRef }: DiffViewProps) {
  const { notify, ui } = useRepo();
  const [open, setOpen] = useState(!viewed);
  const rows = useMemo(() => parsePatch(file.patch), [file.patch]);
  /* The diff's code lines are lexed as one source (hunk headers left out), so strings and comments that span
     lines keep their context; each row then shows its own line's tokens inside the +/- backgrounds. */
  const source = useMemo(() => rows.filter((r) => r.t !== 'hunk' && r.t !== 'note').map((r) => r.text).join('\n'), [rows]);
  const { lines, highlighter } = useSyntaxTokens(source, { language: languageFromPath(file.path) });
  const [selection, setSelection] = useState<Selection | null>(null);
  const threadsAt = (side: 'LEFT' | 'RIGHT', line?: number) => (line == null ? [] : (review?.threads ?? []).filter((t) => t.path === file.path && t.side === side && t.line === line));
  const present = new Set(rows.flatMap((r) => [r.o != null ? `LEFT:${r.o}` : '', r.n != null ? `RIGHT:${r.n}` : '']));
  const orphaned = (review?.threads ?? []).filter((t) => t.path === file.path && (t.line == null || !present.has(`${t.side}:${t.line}`)));
  const pick = (side: 'LEFT' | 'RIGHT', line: number, shift: boolean) => {
    if (shift && selection && selection.side === side && selection.line !== line) setSelection({ side, line: Math.max(line, selection.line), start: Math.min(line, selection.line) });
    else setSelection({ side, line });
  };
  const selected = (side: 'LEFT' | 'RIGHT', line?: number) => !!selection && line != null && selection.side === side && line <= selection.line && line >= (selection.start ?? selection.line);
  const num = (r: DiffRow, side: 'LEFT' | 'RIGHT') => {
    const line = side === 'LEFT' ? r.o : r.n;
    return (
      <td className={cn('w-[1%] min-w-[44px] px-2 text-right align-top text-muted-foreground select-none', NUM_BG[r.t], selected(side, line) && 'bg-(--gh-hl)')}>
        {line ?? ''}
      </td>
    );
  };
  const addButton = (side: 'LEFT' | 'RIGHT', line?: number) => (review?.canComment && line != null ? (
    <button type="button" aria-label={`Comment on line ${line}`} onClick={(e) => pick(side, line, e.shiftKey)}
      className="absolute top-0 left-0 z-1 grid size-5 cursor-pointer place-items-center rounded-sm border-0 bg-primary text-white opacity-0 outline-none group-hover/line:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary group-data-[phone=true]/gh:relative group-data-[phone=true]/gh:mr-1 group-data-[phone=true]/gh:inline-grid group-data-[phone=true]/gh:size-7 group-data-[phone=true]/gh:bg-transparent group-data-[phone=true]/gh:text-primary group-data-[phone=true]/gh:opacity-100">
      <Oct name="plus" size={12} />
    </button>
  ) : null);
  let k = 0;
  const below = (side: 'LEFT' | 'RIGHT', line: number | undefined, colSpan: number) => {
    const here = threadsAt(side, line);
    const composing = selection && selection.side === side && selection.line === line;
    if (!here.length && !composing) return null;
    return (
      <tr>
        <td colSpan={colSpan} className="border-y border-border bg-muted p-2 font-sans text-detail whitespace-normal">
          <div className="max-w-[820px] space-y-2">
            {here.map((t) => <Fragment key={t.id}>{review!.renderThread(t)}</Fragment>)}
            {composing ? <LineComposer review={review!} path={file.path} selection={selection} onDone={() => setSelection(null)} /> : null}
          </div>
        </td>
      </tr>
    );
  };
  return (
    <div id={'diff-' + file.path} className="overflow-hidden rounded-md border border-border">
      <div className="sticky top-0 z-2 flex min-h-11 flex-wrap items-center gap-2 border-b border-border bg-muted px-2 py-1.5">
        <Button aria-label={open ? 'Collapse file' : 'Expand file'} aria-expanded={open} onPress={() => setOpen(!open)}
          className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:size-11">
          <Oct name={open ? 'chevDown' : 'chevRight'} />
        </Button>
        <DiffStat add={file.additions} del={file.deletions} />
        {file.status && STATUS[file.status] ? <span className={cn('rounded-full border px-1.5 text-caption2 leading-4 font-medium', STATUS[file.status][1])}>{STATUS[file.status][0]}</span> : null}
        <span className="min-w-0 font-mono text-caption font-semibold break-all text-foreground">{file.previous ? `${file.previous} → ` : ''}{file.path}</span>
        <Button aria-label={`Copy path ${file.path}`} onPress={() => { void navigator.clipboard?.writeText(file.path).catch(() => {}); notify('Path copied'); }}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11">
          <Oct name="copy" size={14} />
        </Button>
        <span className="flex-1" />
        {browseRef && file.status !== 'removed' ? <GhLink to={{ s: 'code', ref: browseRef, path: file.path }} className="text-caption text-primary no-underline hover:underline">View file</GhLink> : null}
        {onViewed ? (
          <Checkbox isSelected={!!viewed} onChange={(v) => { onViewed(v); if (v) setOpen(false); }} className="ml-1 text-caption text-foreground">Viewed</Checkbox>
        ) : null}
      </div>
      {open ? (
        <>
          {orphaned.length ? (
            <div className="space-y-2 border-b border-border bg-muted p-2">
              <p className="m-0 text-caption text-muted-foreground">On lines no longer in this diff:</p>
              {orphaned.map((t) => <Fragment key={t.id}>{review!.renderThread(t)}</Fragment>)}
            </div>
          ) : null}
          {!file.patch ? (
            <div className="px-4 py-6 text-center text-caption text-muted-foreground">{file.note ?? 'No changes to show.'}</div>
          ) : (
            /* Keyboard users scroll a wide diff with the arrow keys. */
            <div className="overflow-x-auto font-mono text-caption leading-5" tabIndex={0} role="region" aria-label={`Changes in ${file.path}`}>
              <table className="w-full border-collapse" data-highlighter={highlighter} data-language={languageFromPath(file.path)}>
                <tbody>
                  {split && !ui.phone ? (
                    splitRows(rows, () => lines[k++]).map((pair, i) => pair.hunk ? (
                      <tr key={i} className={ROW_BG.hunk}><td colSpan={4} className="px-3 py-1 whitespace-pre text-(--gh-hunk-fg)">{pair.hunk}</td></tr>
                    ) : (
                      <Fragment key={i}>
                        <tr className="group/line">
                          {pair.l ? num(pair.l.row, 'LEFT') : <td className="w-[1%] bg-muted" />}
                          <td className={cn('relative w-1/2 pr-2 pl-5 align-top whitespace-pre-wrap text-foreground', pair.l ? ROW_BG[pair.l.row.t] : 'bg-muted')}>
                            {pair.l ? <>{addButton('LEFT', pair.l.row.o)}<SyntaxTokens tokens={pair.l.tokens ?? [{ type: 'plain', text: pair.l.row.text }]} /></> : null}
                          </td>
                          {pair.r ? num(pair.r.row, 'RIGHT') : <td className="w-[1%] bg-muted" />}
                          <td className={cn('relative w-1/2 pr-2 pl-5 align-top whitespace-pre-wrap text-foreground', pair.r ? ROW_BG[pair.r.row.t] : 'bg-muted')}>
                            {pair.r ? <>{addButton('RIGHT', pair.r.row.n)}<SyntaxTokens tokens={pair.r.tokens ?? [{ type: 'plain', text: pair.r.row.text }]} /></> : null}
                          </td>
                        </tr>
                        {pair.l && pair.l.row.t === 'del' ? below('LEFT', pair.l.row.o, 4) : null}
                        {pair.r ? below('RIGHT', pair.r.row.n, 4) : null}
                      </Fragment>
                    ))
                  ) : rows.map((r, i) => {
                    if (r.t === 'hunk') return <tr key={i} className={ROW_BG.hunk}><td colSpan={3} className="px-3 py-1 whitespace-pre text-(--gh-hunk-fg)">{r.text}</td></tr>;
                    if (r.t === 'note') return <tr key={i}><td colSpan={3} className="px-3 text-muted-foreground italic">{r.text}</td></tr>;
                    const tokens = lines[k++];
                    const side = r.t === 'del' ? 'LEFT' : 'RIGHT';
                    const line = r.t === 'del' ? r.o : r.n;
                    return (
                      <Fragment key={i}>
                        <tr className={cn('group/line', ROW_BG[r.t])}>
                          {num(r, 'LEFT')}
                          {num(r, 'RIGHT')}
                          <td className="relative pr-6 pl-5 whitespace-pre text-foreground">
                            {addButton(side, line)}
                            <span className="inline-block w-4 text-muted-foreground select-none">{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' '}</span>
                            <SyntaxTokens tokens={tokens ?? [{ type: 'plain', text: r.text }]} />
                          </td>
                        </tr>
                        {below(side, line, 3)}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

type SplitSide = { row: DiffRow; tokens?: readonly SyntaxToken[] };
/** Deletions on the left paired with additions on the right, context on both. */
function splitRows(rows: DiffRow[], next: () => unknown): { hunk?: string; l?: SplitSide; r?: SplitSide }[] {
  const out: { hunk?: string; l?: SplitSide; r?: SplitSide }[] = [];
  let dels: SplitSide[] = [];
  let adds: SplitSide[] = [];
  const flush = () => {
    for (let i = 0; i < Math.max(dels.length, adds.length); i++) out.push({ l: dels[i], r: adds[i] });
    dels = [];
    adds = [];
  };
  for (const r of rows) {
    if (r.t === 'hunk') { flush(); out.push({ hunk: r.text }); continue; }
    if (r.t === 'note') continue;
    const tokens = next() as SplitSide['tokens'];
    if (r.t === 'del') dels.push({ row: r, tokens });
    else if (r.t === 'add') adds.push({ row: r, tokens });
    else { flush(); out.push({ l: { row: r, tokens }, r: { row: r, tokens } }); }
  }
  flush();
  return out;
}

function LineComposer({ review, path, selection, onDone }: { review: DiffReview; path: string; selection: Selection; onDone: () => void }) {
  const [body, setBody] = useState('');
  const act = useAction();
  const send = (mode: 'single' | 'review') => {
    if (!body.trim()) return;
    void act.run(async () => {
      await review.addComment({ path, line: selection.line, side: selection.side, startLine: selection.start, body: body.trim() }, mode);
      onDone();
    });
  };
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <p className="mt-0 mb-1 text-caption text-muted-foreground">{selection.start ? `Comment on lines ${selection.start} to ${selection.line}` : `Comment on line ${selection.line}`}. Shift-click another line’s + for a range.</p>
      <MarkdownField label={`Comment on line ${selection.line} of ${path}`} value={body} onChange={setBody} autoFocus rows={3} placeholder="Leave a comment" onSubmit={() => send('review')} disabled={act.busy} />
      <ActionError error={act.error} className="mt-2" />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button className={ghButton()} isDisabled={act.busy} onPress={onDone}>Cancel</Button>
        {!review.pending ? <Button className={ghButton()} isDisabled={act.busy || !body.trim()} onPress={() => send('single')}>Add single comment</Button> : null}
        <Button className={ghButton(true)} isDisabled={act.busy || !body.trim()} onPress={() => send('review')}>{review.pending ? 'Add review comment' : 'Start a review'}</Button>
      </div>
    </div>
  );
}

/** Builds a folder tree from the changed paths. */
export function treeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const p of paths) {
    let level = root;
    p.split('/').forEach((name, i, parts) => {
      const path = parts.slice(0, i + 1).join('/');
      let n = level.find((x) => x.name === name);
      if (!n) {
        n = { name, path, type: i === parts.length - 1 ? 'file' : 'dir', commit: '', when: '', children: i === parts.length - 1 ? undefined : [] };
        level.push(n);
      }
      level = n.children ?? [];
    });
  }
  return root;
}

/** A diff's whole page: the unified/split switch, a file filter, the tree on wide layouts. */
export function DiffFiles({ files, viewedSet, onViewed, review, toolbar, browseRef, empty = 'No files changed.' }: {
  files: DiffFile[]; viewedSet?: Set<string>; onViewed?: (path: string, v: boolean) => void; review?: DiffReview; toolbar?: ReactNode; browseRef?: string; empty?: string;
}) {
  const { ui } = useRepo();
  const [split, setSplit] = useState(false);
  const [filter, setFilter] = useState('');
  const shown = files.filter((f) => !filter || f.path.toLowerCase().includes(filter.toLowerCase()));
  const add = files.reduce((s, f) => s + f.additions, 0);
  const del = files.reduce((s, f) => s + f.deletions, 0);
  const [selected, setSelected] = useState<string | undefined>();
  const viewedCount = viewedSet ? files.filter((f) => viewedSet.has(f.path)).length : 0;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {toolbar}
        <span className="flex items-center gap-2 text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'} <DiffStat add={add} del={del} /></span>
        <span className="flex-1" />
        <label className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-muted-foreground group-data-[phone=true]/gh:h-11">
          <Oct name="filter" size={14} />
          <input aria-label="Filter changed files" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files" className="w-28 border-0 bg-transparent font-sans text-caption text-foreground outline-none select-text" />
        </label>
        {!ui.phone ? (
          <div className="flex" role="group" aria-label="Diff layout">
            <Button aria-pressed={!split} aria-label="Unified diff" className={cn(ghButton(), 'rounded-r-none px-2', !split && 'bg-secondary-strong')} onPress={() => setSplit(false)}><Oct name="rows" /></Button>
            <Button aria-pressed={split} aria-label="Split diff" className={cn(ghButton(), '-ml-px rounded-l-none px-2', split && 'bg-secondary-strong')} onPress={() => setSplit(true)}><Oct name="columns" /></Button>
          </div>
        ) : null}
        {viewedSet ? <span className="text-caption text-muted-foreground" role="status">{viewedCount} / {files.length} viewed</span> : null}
      </div>
      <div className="flex gap-4">
        {ui.wide && files.length > 1 ? (
          <aside className="w-[260px] shrink-0" aria-label="Changed files">
            <div className="sticky top-0">
              <FileTree nodes={treeFromPaths(shown.map((f) => f.path))} selected={selected ?? shown[0]?.path} defaultOpen
                onSelect={(n) => { setSelected(n.path); document.getElementById('diff-' + n.path)?.scrollIntoView({ block: 'start' }); }} />
            </div>
          </aside>
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          {shown.map((f) => (
            <DiffView key={f.path} file={f} split={split} review={review} browseRef={browseRef}
              viewed={viewedSet?.has(f.path)} onViewed={onViewed ? (v) => onViewed(f.path, v) : undefined} />
          ))}
          {!shown.length ? <Box className="px-6 py-12 text-center text-muted-foreground">{files.length ? 'No changed files match that filter.' : empty}</Box> : null}
        </div>
      </div>
    </div>
  );
}
