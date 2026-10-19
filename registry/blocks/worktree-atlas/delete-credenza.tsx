/* The one way worktrees get deleted: a Credenza (a dialog on desktop, a tray on the phone) that lists what will go,
   checks each for uncommitted work first, and morphs from Confirm → Deleting → Done. Like `git worktree remove`,
   a worktree with uncommitted or untracked files is kept unless you tick the box to delete it anyway; a locked
   one is always kept; a missing one only has Git's record pruned. Branches and commits stay in the repository. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Credenza } from '@/components/ui/credenza';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { formatBytes } from './data';
import { BranchIcon, branchLabel, shortPath } from './parts';
import type { RemoveResult, Worktree, WorktreeStatus } from './types';
import type { AtlasState } from './use-atlas';

type Check = { state: 'checking' } | { state: 'done'; status: WorktreeStatus } | { state: 'failed'; error: string };

function Note({ w, check, result }: { w: Worktree; check?: Check; result?: RemoveResult }) {
  if (result) {
    return result.ok
      ? <span className="flex items-center gap-1 text-success"><Icon name="check-circle-fill" size={14} />Deleted</span>
      : <span className="text-destructive">{result.error}</span>;
  }
  if (w.locked) return <span className="text-warning">Locked — will be kept</span>;
  if (w.missing) return <span>Folder is gone — prunes Git’s record</span>;
  if (!check || check.state === 'checking') return <span className="flex items-center gap-1.5"><Spinner size={11} label="Checking" />Checking for changes…</span>;
  if (check.state === 'failed') return <span className="text-warning">{check.error}</span>;
  const n = check.status.changed;
  const unpushed = check.status.unpushed ?? [];
  const lost = [n ? `${n} uncommitted change${n === 1 ? '' : 's'}` : '', unpushed.length ? `not pushed: ${unpushed.join(', ')}` : ''].filter(Boolean);
  if (lost.length) return <span className="text-warning">{w.clone ? 'Whole clone · ' : ''}{lost.join(' · ')}</span>;
  return <span>{w.clone ? 'Whole clone · everything is pushed' : 'No uncommitted changes'}</span>;
}

function Rows({ worktrees, checks, results }: { worktrees: Worktree[]; checks: Map<string, Check>; results?: RemoveResult[] }) {
  return (
    <ul className="m-0 max-h-[280px] list-none overflow-y-auto p-0 rounded-card bg-secondary">
      {worktrees.map((w, i) => (
        <li key={w.id} className={cn('px-3.5 py-2.5', i > 0 && 'shadow-hairline-t')}>
          <div className="flex items-center gap-1.5 text-subhead font-semibold">
            <BranchIcon size={14} className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{branchLabel(w)}</span>
            {w.size ? <span className="text-caption font-normal text-muted-foreground tabular-nums">{formatBytes(w.size)}</span> : null}
          </div>
          <div className="mt-0.5 truncate font-mono text-caption text-muted-foreground">{shortPath(w.path)}</div>
          <div className="mt-1 text-caption text-muted-foreground">
            <Note w={w} check={checks.get(w.id)} result={results?.find((r) => r.id === w.id)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DeleteCredenza({ atlas, compact }: { atlas: AtlasState; compact: boolean }) {
  const pending = atlas.pendingDelete;
  const [list, setList] = useState<Worktree[]>([]);
  const [view, setView] = useState<'confirm' | 'deleting' | 'done'>('confirm');
  const [checks, setChecks] = useState(new Map<string, Check>());
  const [force, setForce] = useState(false);
  const [results, setResults] = useState<RemoveResult[]>([]);
  const { source } = atlas;

  // A new request starts over, and checks each worktree for work that deleting would lose.
  useEffect(() => {
    if (!pending) return;
    setList(pending); setView('confirm'); setForce(false); setResults([]);
    let live = true;
    const next = new Map<string, Check>();
    for (const w of pending) if (!w.locked && !w.missing) next.set(w.id, { state: 'checking' });
    setChecks(next);
    for (const w of pending) {
      if (w.locked || w.missing) continue;
      source.status(w)
        .then((status) => { if (live) setChecks((c) => new Map(c).set(w.id, { state: 'done', status })); })
        .catch((e) => { if (live) setChecks((c) => new Map(c).set(w.id, { state: 'failed', error: e instanceof Error ? e.message : String(e) })); });
    }
    return () => { live = false; };
  }, [pending, source]);

  // Work that deleting would lose: uncommitted files, or (for a clone) branches no remote has.
  const dirty = list.filter((w) => { const c = checks.get(w.id); return c?.state === 'done' && (c.status.dirty || !!c.status.unpushed?.length); });
  const kept = list.filter((w) => w.locked || (!force && dirty.includes(w)));
  const going = list.length - kept.length;
  const checking = [...checks.values()].some((c) => c.state === 'checking');
  const one = list.length === 1;

  const confirm = async () => {
    setView('deleting');
    // Locked worktrees and (without force) dirty ones are left out rather than sent to fail.
    const send = list.filter((w) => !kept.includes(w));
    const removed = await source.remove(send, { force }).catch((e): RemoveResult[] => send.map((w) => ({ id: w.id, ok: false, error: e instanceof Error ? e.message : String(e) })));
    const skippedResults = kept.map((w): RemoveResult => ({ id: w.id, ok: false, error: w.locked ? 'Locked — kept' : 'Unsaved work — kept' }));
    setResults([...removed, ...skippedResults]);
    atlas.applyRemoved(removed);
    atlas.setEditing(false);
    setView('done');
  };

  const close = () => { if (view !== 'deleting') atlas.cancelDelete(); };
  const deleted = results.filter((r) => r.ok).length;
  const title = view === 'done' ? (deleted ? `Deleted ${deleted} Worktree${deleted === 1 ? '' : 's'}` : 'Nothing Deleted')
    : view === 'deleting' ? 'Deleting…' : one ? 'Delete Worktree?' : `Delete ${list.length} Worktrees?`;

  return (
    <Credenza open={!!pending} onClose={close} isDismissable={view !== 'deleting'} compact={compact} view={view} title={title}>
      {view === 'deleting' ? (
        <div className="grid place-items-center gap-3 px-5 pt-4 pb-8 text-subhead text-muted-foreground">
          <Spinner size={26} label="Deleting" />
          Deleting {going} folder{going === 1 ? '' : 's'}…
        </div>
      ) : (
        <div className="px-4 pt-1 pb-4">
          {view === 'confirm' ? (
            <p className="mx-1 mb-3 text-footnote leading-[1.4] text-muted-foreground">
              {one ? 'Its folder and Git’s record of it are' : 'Their folders and Git’s records of them are'} deleted, like <code className="font-mono">git worktree remove</code>. Branches and commits stay in the repository.
              {list.some((w) => w.clone) ? ' A clone is deleted with its whole history.' : ''}
            </p>
          ) : null}
          <Rows worktrees={list} checks={checks} results={view === 'done' ? results : undefined} />
          {view === 'confirm' && dirty.length ? (
            <Checkbox isSelected={force} onChange={setForce} className="mx-1 mt-3 text-footnote">
              Also delete {dirty.length === 1 && one ? 'it' : `the ${dirty.length} with unsaved work`} — that work is lost
            </Checkbox>
          ) : null}
          <div className="mt-4 grid gap-2">
            {view === 'confirm' ? <>
              <Button size="pill" variant="destructive" isDisabled={checking || going === 0} onPress={() => void confirm()}>
                {checking ? 'Checking…' : going === 0 ? 'Nothing to Delete' : one ? 'Delete Worktree' : `Delete ${going} Worktree${going === 1 ? '' : 's'}`}
              </Button>
              <Button size="pill" variant="secondary" data-autofocus onPress={close}>Cancel</Button>
            </> : <Button size="pill" onPress={close}>Done</Button>}
          </div>
        </div>
      )}
    </Credenza>
  );
}
