'use client';
import { useDeferredValue, useEffect, useMemo, useSyncExternalStore } from 'react';
import { PlainButton, PlainToggleButton } from '@/components/ui/plain-button';
import { SearchField } from '@/components/ui/search-field';
import { TreeFileIcon } from '@/components/ui/tree';
import { cn } from '@/lib/utils';
import { SidebarHeader } from './explorer';
import { basename, dirname, searchFiles, type SearchFileResult, type SearchMatch } from './files';
import type { VSCodeStore } from './store';

function Toggle({ label, title, selected, onChange }: { label: string; title: string; selected: boolean; onChange: (selected: boolean) => void }) {
  return (
    <PlainToggleButton
      isSelected={selected}
      onChange={onChange}
      aria-label={title}
      title={title}
      className={cn(
        'grid h-6 min-w-6 cursor-pointer place-items-center rounded-[5px] border border-transparent bg-transparent px-1 font-mono text-caption2 text-muted-foreground outline-none',
        'data-hovered:bg-secondary data-selected:border-primary/60 data-selected:bg-primary/15 data-selected:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring/45',
      )}
    >
      {label}
    </PlainToggleButton>
  );
}

function MatchRow({ match, onOpen }: { match: SearchMatch; onOpen: () => void }) {
  const before = match.preview.slice(0, match.previewColumn);
  const hit = match.preview.slice(match.previewColumn, match.previewColumn + match.length);
  const after = match.preview.slice(match.previewColumn + match.length);
  return (
    <li>
      <PlainButton
        onPress={onOpen}
        aria-label={`Line ${match.line}: ${match.preview}`}
        className="flex w-full cursor-pointer items-baseline gap-2 truncate border-0 bg-transparent py-0.5 ps-9 pe-3 text-start font-mono text-caption2 text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset data-hovered:bg-secondary"
      >
        <span className="min-w-0 truncate">
          {before}
          <mark className="rounded-[2px] bg-primary/25 text-foreground">{hit}</mark>
          {after}
        </span>
      </PlainButton>
    </li>
  );
}

function FileGroup({ file, root, onOpen }: { file: SearchFileResult; root: string; onOpen: (match: SearchMatch) => void }) {
  const folder = dirname(file.path);
  return (
    <li>
      <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 text-caption">
        <TreeFileIcon name={basename(file.path)} size={15} className="shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{basename(file.path)}</span>
        <span className="min-w-0 flex-1 truncate text-caption2 text-muted-foreground">{folder === root ? '' : folder.slice(root.length + 1)}</span>
        <span className="rounded-full bg-secondary px-1.5 text-caption2 text-muted-foreground">{file.matches.length}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {file.matches.map((match) => (
          <MatchRow key={`${match.line}:${match.column}`} match={match} onOpen={() => onOpen(match)} />
        ))}
      </ul>
    </li>
  );
}

/** Finds text in every file, as they are this moment, and opens a result where it is. */
export function SearchPanel({ store }: { store: VSCodeStore }) {
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const query = store.searchQuery;
  const matchCase = store.searchMatchCase;
  const regex = store.searchRegex;
  // The latest keystroke stays quick however many files there are.
  const deferred = useDeferredValue(query);
  // Reading every file is left until someone searches. New files get read as they appear.
  useEffect(() => { if (deferred) void store.loadForSearch(); }, [store, deferred, version]);
  const results = useMemo(
    () => searchFiles(store.searchable(), deferred, { matchCase, regex }),
    // `version` stands for the files.
    [store, deferred, matchCase, regex, version],
  );

  return (
    <div data-slot="vscode-search" className="flex h-full min-h-0 flex-col">
      <SidebarHeader title="Search" />
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pb-2">
        <SearchField className="[&_input]:text-footnote" aria-label="Search in files" placeholder="Search" value={query} onChange={(next) => store.setSearch({ query: next })} />
        <div className="flex items-center gap-1">
          <Toggle label="Aa" title="Match case" selected={matchCase} onChange={(next) => store.setSearch({ matchCase: next })} />
          <Toggle label=".*" title="Use regular expression" selected={regex} onChange={(next) => store.setSearch({ regex: next })} />
          <span role="status" className="ms-auto text-caption2 text-muted-foreground">
            {results.error
              ? 'Invalid expression'
              : deferred
                ? `${results.limited ? 'First ' : ''}${results.count.toLocaleString('en-US')} ${results.count === 1 ? 'result' : 'results'} in ${results.files.length} ${results.files.length === 1 ? 'file' : 'files'}`
                : ''}
          </span>
        </div>
      </div>
      <ul className="m-0 min-h-0 flex-1 list-none overflow-auto bl-scroll p-0 pb-2">
        {results.files.map((file) => (
          <FileGroup key={file.path} file={file} root={store.root} onOpen={(match) => store.openFile(file.path, { line: match.line, column: match.column, length: match.length })} />
        ))}
      </ul>
    </div>
  );
}
