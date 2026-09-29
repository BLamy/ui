/* Credenzas: the Clone dialog ("Code ▾") and the label filter — a dialog when wide, a tray on phone. */
import { useState } from 'react';
import { Button, Credenza, List, ListRow, Segmented, cn } from '@brett_lamy/ui';
import { LABELS, REPO } from './data';
import { Oct, ghButton } from './parts';

export function CloneDialog({ open, onClose, compact }: { open: boolean; onClose: () => void; compact: boolean }) {
  const [proto, setProto] = useState('https');
  const url = { https: `https://github.com/${REPO.owner}/${REPO.name}.git`, ssh: `git@github.com:${REPO.owner}/${REPO.name}.git`, cli: `gh repo clone ${REPO.owner}/${REPO.name}` }[proto];
  return (
    <Credenza open={open} onClose={onClose} title="Clone" compact={compact}>
      <div className="px-4 pt-2 pb-4">
        <Segmented aria-label="Protocol" value={proto} onChange={setProto}
          options={[{ id: 'https', label: 'HTTPS' }, { id: 'ssh', label: 'SSH' }, { id: 'cli', label: 'GitHub CLI' }]} />
        <div className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-border bg-muted pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
          <Button aria-label="Copy URL" className={cn(ghButton(), 'h-7 w-7 px-0')}><Oct name="copy" size={14} /></Button>
        </div>
        <p className="mt-2 mb-3 text-[12px] text-muted-foreground">
          {proto === 'cli' ? 'Work fast with our official CLI.' : proto === 'ssh' ? 'Use a password-protected SSH key.' : 'Clone using the web URL.'}
        </p>
        <List className="overflow-hidden rounded-xl border border-border">
          <ListRow leading={<Oct name="desktop" className="text-muted-foreground" />} title="Open with GitHub Desktop" onPress={onClose} className="[&_[data-slot=list-row-content]]:text-[15px]" />
          <ListRow leading={<Oct name="zip" className="text-muted-foreground" />} title="Download ZIP" divider={false} onPress={onClose} className="[&_[data-slot=list-row-content]]:text-[15px]" />
        </List>
      </div>
    </Credenza>
  );
}

export function LabelFilter({ open, onClose, compact, value, onChange }: {
  open: boolean; onClose: () => void; compact: boolean; value: string[]; onChange: (v: string[]) => void;
}) {
  const labels = Object.values(LABELS);
  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
  return (
    <Credenza open={open} onClose={onClose} title="Filter by label" compact={compact}>
      <div className="px-4 pt-1 pb-4">
        <List className="overflow-hidden rounded-xl border border-border">
          {labels.map((l, i) => (
            <ListRow key={l.name} title={l.name} subtitle={l.description} accessory="check" checked={value.includes(l.name)}
              onPress={() => toggle(l.name)} divider={i < labels.length - 1} className="[&_[data-slot=list-row-content]]:text-[15px] [&_[data-slot=list-row-body]]:min-h-0 [&_[data-slot=list-row-body]]:py-2"
              leading={<span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} />} />
          ))}
        </List>
        <div className="mt-4 flex gap-2">
          <Button className={cn(ghButton(), 'flex-1')} onPress={() => onChange([])}>Clear</Button>
          <Button className={cn(ghButton(true), 'flex-1')} onPress={onClose}>Done</Button>
        </div>
      </div>
    </Credenza>
  );
}
