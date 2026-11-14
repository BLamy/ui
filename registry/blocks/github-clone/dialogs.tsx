/* Credenzas: the Clone dialog ("Code ▾"), the label filter and the repository picker — a dialog when wide, a tray on
   phone. The picker is where the data comes from: the keychain's GitHub sign-in (sign in, unlock, or who is signed in
   and how much rate limit is left), any owner/name or github.com URL, the account's recently pushed repositories, and
   the sample repository. */
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza, CredenzaBackdrop, CredenzaClose, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { List, ListRow } from '@/components/ui/list';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import type { KeychainSignIn } from '../apple-passwords/page';
import { parseRepo, recentRepos, type GitHub } from './github-api';
import { Oct, ghButton } from './parts';
import { Loaded, useLoad, useRepo } from './repo-context';
import { SAMPLE_SOURCE, type RepoSource } from './source';

/** The block's Credenza: a titled card when wide, a tray on phone (Credenza's `auto`, from the block's size-class scope). */
function GhCredenza({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Credenza open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <CredenzaBackdrop />
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>{title}</CredenzaTitle>
          <CredenzaClose />
        </CredenzaHeader>
        {children}
      </CredenzaContent>
    </Credenza>
  );
}

export function CloneDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { repo } = useRepo();
  const [proto, setProto] = useState('https');
  const url = { https: `https://github.com/${repo.owner}/${repo.name}.git`, ssh: `git@github.com:${repo.owner}/${repo.name}.git`, cli: `gh repo clone ${repo.owner}/${repo.name}` }[proto];
  return (
    <GhCredenza open={open} onClose={onClose} title="Clone">
      <div className="px-4 pt-2 pb-4">
        <Segmented aria-label="Protocol" value={proto} onValueChange={(next) => { if (next) setProto(next); }}>
          <SegmentedItem value="https">HTTPS</SegmentedItem>
          <SegmentedItem value="ssh">SSH</SegmentedItem>
          <SegmentedItem value="cli">GitHub CLI</SegmentedItem>
        </Segmented>
        <div className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-border bg-muted pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-footnote">{url}</code>
          <Button aria-label="Copy URL" className={cn(ghButton(), 'h-7 w-7 px-0')} onClick={() => void navigator.clipboard?.writeText(url ?? '').catch(() => {})}><Oct name="copy" size={14} /></Button>
        </div>
        <p className="mt-2 mb-3 text-caption text-muted-foreground">
          {proto === 'cli' ? 'Work fast with our official CLI.' : proto === 'ssh' ? 'Use a password-protected SSH key.' : 'Clone using the web URL.'}
        </p>
        <List className="overflow-hidden rounded-xl border border-border">
          <ListRow leading={<Oct name="desktop" className="text-muted-foreground" />} title="Open with GitHub Desktop" onClick={onClose} className="[&_[data-slot=list-row-content]]:text-subhead" />
          <ListRow leading={<Oct name="zip" className="text-muted-foreground" />} title="Download ZIP" divider={false} onClick={onClose} className="[&_[data-slot=list-row-content]]:text-subhead" />
        </List>
      </div>
    </GhCredenza>
  );
}

export function LabelFilter({ open, onClose, value, onChange }: {
  open: boolean; onClose: () => void; value: string[]; onChange: (v: string[]) => void;
}) {
  const { source } = useRepo();
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
  return (
    <GhCredenza open={open} onClose={onClose} title="Filter by label">
      <div className="px-4 pt-1 pb-4">
        <List className="max-h-[50vh] overflow-auto rounded-xl border border-border">
          {labels.map((l, i) => (
            <ListRow key={l.name} title={l.name} subtitle={l.description} accessory="check" checked={value.includes(l.name)}
              onClick={() => toggle(l.name)} divider={i < labels.length - 1} className="[&_[data-slot=list-row-content]]:text-subhead [&_[data-slot=list-row-body]]:min-h-0 [&_[data-slot=list-row-body]]:py-2"
              leading={<span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} />} />
          ))}
        </List>
        <div className="mt-4 flex gap-2">
          <Button className={cn(ghButton(), 'flex-1')} onClick={() => onChange([])}>Clear</Button>
          <CredenzaClose render={<Button className={cn(ghButton(true), 'flex-1')} />}>Done</CredenzaClose>
        </div>
      </div>
    </GhCredenza>
  );
}

/** Choose the repository: `onPick(full)` for a GitHub one, `onPick(null)` for the sample. */
export function RepoPicker({ open, onClose, keychain, gh, current, onPick }: {
  open: boolean; onClose: () => void; keychain: KeychainSignIn | null; gh: GitHub | null; current: RepoSource; onPick: (full: string | null) => void;
}) {
  const [input, setInput] = useState('');
  const parsed = parseRepo(input);
  const rate = gh?.rateLimit();
  const row = '[&_[data-slot=list-row-content]]:text-subhead [&_[data-slot=list-row-body]]:min-h-0 [&_[data-slot=list-row-body]]:py-2';
  return (
    <GhCredenza open={open} onClose={onClose} title="Repository">
      <div className="grid gap-4 px-4 pt-1 pb-4">
        {/* Signing in opens the keychain's own sheet: this one steps aside first. */}
        <AccountStatus keychain={keychain && { ...keychain, signIn: () => { onClose(); keychain.signIn(); } }} gh={gh} current={current} />
        {gh ? (
          <>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (parsed) { onPick(parsed); setInput(''); } }}>
              <Input aria-label="Repository (owner/name or GitHub URL)" placeholder="owner/name or a github.com URL" autoComplete="off" spellCheck={false}
                value={input} onValueChange={(next) => setInput(next)} className="min-w-0 flex-1 font-mono text-footnote" />
              <Button type="submit" className={ghButton(true)} disabled={!parsed}>Open</Button>
            </form>
            {open ? <Recent gh={gh} current={current.full} onPick={onPick} row={row} /> : null}
          </>
        ) : null}
        <List className="overflow-hidden rounded-xl border border-border">
          <ListRow title={SAMPLE_SOURCE.full} subtitle="Sample repository — invented data, works offline" accessory="check" checked={!current.live}
            leading={<Oct name="book" className="text-muted-foreground" />} onClick={() => onPick(null)} divider={false} className={row} />
        </List>
        {rate && current.live ? (
          <p className="m-0 text-caption text-muted-foreground">
            GitHub API: {rate.remaining.toLocaleString('en-US')} of {rate.limit.toLocaleString('en-US')} requests left this hour
            {rate.resetAt ? `, resets at ${new Date(rate.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.
          </p>
        ) : null}
      </div>
    </GhCredenza>
  );
}

function AccountStatus({ keychain, gh, current }: { keychain: KeychainSignIn | null; gh: GitHub | null; current: RepoSource }) {
  const box = 'flex items-start gap-3 rounded-xl border border-border bg-muted px-3 py-2.5';
  if (gh) {
    return (
      <div className={box}>
        <Oct name="checkFill" className="mt-0.5 text-[var(--gh-open)]" />
        <div className="min-w-0 flex-1 text-footnote">
          <b className="font-semibold">{current.live ? `Live from GitHub: ${current.full}` : 'Signed in with GitHub'}</b>
          <div className="text-muted-foreground">
            {keychain?.account ? <>Using {keychain.account}’s sign-in from the Passwords keychain.</> : 'Using the token this block was given.'}
          </div>
        </div>
      </div>
    );
  }
  if (!keychain) {
    return <div className={cn(box, 'text-footnote text-muted-foreground')}>Showing the sample repository. This block was set up without the keychain.</div>;
  }
  const [title, text, label, act] = keychain.rejected
    ? ['GitHub turned the saved sign-in down', 'It was revoked or expired. Sign in again to read your repositories.', 'Sign in again', keychain.signIn]
    : keychain.locked
      ? ['Your keychain is locked', 'Unlock it with your passkey to use the GitHub sign-in saved in Passwords.', 'Unlock keychain', () => void keychain.unlock().catch(() => {})]
      : ['Showing sample data', 'Sign in with GitHub to browse real repositories — the token is kept in the Passwords keychain, encrypted with your passkey.', 'Sign in with GitHub', keychain.signIn];
  return (
    <div className={cn(box, 'flex-col')}>
      <div className="text-footnote">
        <b className="font-semibold">{title}</b>
        <div className="text-muted-foreground">{text}</div>
      </div>
      <div className="flex gap-2">
        <Button className={ghButton(true)} onClick={act}>{keychain.locked && !keychain.rejected ? <Oct name="lock" size={14} /> : null}{label}</Button>
        {keychain.locked && !keychain.rejected ? <Button className={ghButton()} onClick={keychain.signIn}>Sign in with GitHub</Button> : null}
      </div>
    </div>
  );
}

function Recent({ gh, current, onPick, row }: { gh: GitHub; current: string; onPick: (full: string) => void; row: string }) {
  const recent = useLoad('recent', () => recentRepos(gh));
  return (
    <Loaded load={recent} pending={<p className="m-0 text-caption text-muted-foreground">Loading your repositories…</p>}>
      {(list) => list.length ? (
        <List className="max-h-[40vh] overflow-auto rounded-xl border border-border" aria-label="Your repositories">
          {list.map((r, i) => (
            <ListRow key={r.full} title={r.full} subtitle={r.description || undefined} accessory="check" checked={r.full.toLowerCase() === current.toLowerCase()}
              leading={<Oct name={r.private ? 'lock' : 'book'} className="text-muted-foreground" />} onClick={() => onPick(r.full)} divider={i < list.length - 1} className={row} />
          ))}
        </List>
      ) : null}
    </Loaded>
  );
}
