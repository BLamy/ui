/* The block's dialogs — Share, Project settings, Connect issue tracker and New project — are views of one
   Credenza (a centred dialog, or a bottom tray on a phone): switching between them morphs the card's height and
   slides the views, and the tracker view is one step "into" settings, so it comes back the way it went. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { List, ListRow } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { PROJECTS, TRACKERS, host } from './data';
import { Avatar } from './parts';
import { useLoopQA, type DialogName } from './state';

const TITLES: Record<Exclude<DialogName, null>, string> = {
  share: 'Share project', settings: 'Project settings', tracker: 'Connect issue tracker', 'new-project': 'New project',
};

export function Dialogs({ compact }: { compact: boolean }) {
  const qa = useLoopQA();
  const [last, setLast] = useState<Exclude<DialogName, null>>('share');
  const view = qa.dialog ?? last;
  if (qa.dialog && qa.dialog !== last) setLast(qa.dialog);
  return (
    <Credenza open={!!qa.dialog} onClose={() => qa.setDialog(null)} view={view} title={TITLES[view]} compact={compact}
      canBack={view === 'tracker'} onBack={() => qa.setDialog('settings')}>
      <div className="px-4 pt-1 pb-4">
        {view === 'share' ? <Share /> : view === 'settings' ? <Settings /> : view === 'tracker' ? <Trackers /> : <NewProject />}
      </div>
    </Credenza>
  );
}

const field = 'flex flex-col gap-1.5 [&_[data-slot=label]]:text-[12.5px] [&_[data-slot=label]]:font-medium [&_[data-slot=label]]:text-muted-foreground';

function Share() {
  const qa = useLoopQA();
  const p = qa.project ?? PROJECTS[0]!;
  const [publicReplays, setPublic] = useState(true);
  const link = `https://loopqa.dev/p/${p.id}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-10 items-center gap-2 rounded-[10px] bg-secondary pr-1 pl-3">
        <Icon name="link" size={14} sw={2} className="shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{link}</code>
        <Button size="sm" className="h-8 rounded-[8px]" onPress={() => qa.copy(link, 'Copied project link')}>Copy</Button>
      </div>
      <List className="overflow-hidden rounded-xl border border-border">
        <ListRow title="Public replays" subtitle="Anyone with a bug's link can watch its replay" divider={false}
          className="[&_[data-slot=list-row-content]]:text-[14px]" trailing={<Switch checked={publicReplays} onChange={setPublic} />} />
      </List>
      <div>
        <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">Members</div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.members.map((m, i) => (
            <li key={m} className="flex items-center gap-2.5">
              <Avatar initials={m} tone={i} />
              <span className="flex-1 text-[13.5px]">{MEMBER_NAMES[m] ?? m}</span>
              <span className="text-[12px] text-muted-foreground">{i === 0 ? 'Owner' : 'Member'}</span>
            </li>
          ))}
        </ul>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); qa.toast.success('Invite sent'); }}>
        <Input size="sm" type="email" aria-label="Invite by email" placeholder="teammate@company.com" className="flex-1 text-[14px]" />
        <Button size="sm" type="submit" className="h-8 rounded-[9px]">Invite</Button>
      </form>
    </div>
  );
}

const MEMBER_NAMES: Record<string, string> = { BL: 'Brett Lamy', MK: 'Maya Kim', AR: 'Ari Rosen', JS: 'Jordan Shah' };

function Settings() {
  const qa = useLoopQA();
  const p = qa.project ?? PROJECTS[0]!;
  const [schedule, setSchedule] = useState('6h');
  const [active, setActive] = useState(p.status === 'active');
  const tracker = TRACKERS.find((t) => qa.trackers.includes(t.id));
  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); qa.setDialog(null); qa.toast.success('Settings saved'); }}>
      <TextField className={field} defaultValue={p.name}><Label>Name</Label><Input size="sm" className="text-[14px]" /></TextField>
      <TextField className={field} defaultValue={p.url}><Label>Target URL</Label><Input size="sm" className="font-mono text-[13px]" /></TextField>
      <TextField className={field} defaultValue={`https://hooks.${host(p.url).replace(/^[^.]+\./, '')}/loopqa`}><Label>Bug webhook</Label><Input size="sm" className="font-mono text-[13px]" /></TextField>
      <div className={field}>
        <span data-slot="label">Test schedule</span>
        <Segmented aria-label="Test schedule" value={schedule} onChange={setSchedule}
          options={[{ id: '1h', label: 'Hourly' }, { id: '6h', label: '6 hours' }, { id: 'nightly', label: 'Nightly' }, { id: 'deploy', label: 'Deploys' }]} />
      </div>
      <List className="overflow-hidden rounded-xl border border-border">
        <ListRow title="Active" subtitle={active ? 'Runs on schedule and on deploys' : 'Paused — no runs'} className="[&_[data-slot=list-row-content]]:text-[14px]"
          trailing={<Switch checked={active} onChange={setActive} />} />
        <ListRow title="Issue tracker" subtitle={tracker ? `${tracker.name} · connected` : 'Not connected'} accessory="chevron" divider={false}
          className="[&_[data-slot=list-row-content]]:text-[14px]" onPress={() => qa.setDialog('tracker')} />
      </List>
      <Button type="submit" className="mt-1 h-10 rounded-[11px]">Save changes</Button>
    </form>
  );
}

function Trackers() {
  const qa = useLoopQA();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] text-muted-foreground">File new bugs automatically, with the replay, the chronology and the root cause attached.</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {TRACKERS.map((t) => {
          const on = qa.trackers.includes(t.id);
          return (
            <li key={t.id} className="flex items-center gap-3 rounded-[12px] border border-border px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-(--c) text-[13px] font-bold text-white" style={{ '--c': t.color } as React.CSSProperties}>{t.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{t.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{t.detail}</span>
              </span>
              <Button size="sm" variant={on ? 'secondary' : 'default'} className={cn('h-8 min-w-[92px] rounded-[9px]', on && 'text-success')}
                isDisabled={on} onPress={() => qa.connectTracker(t.id, t.name)}>
                {on ? 'Connected' : 'Connect'}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewProject() {
  const qa = useLoopQA();
  const [url, setUrl] = useState('');
  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => {
      e.preventDefault();
      qa.setDialog(null);
      qa.toast.success('Project created', { description: `Exploring ${url.replace(/^https?:\/\//, '') || 'your app'} — first findings in about 10 minutes.` });
    }}>
      <p className="m-0 text-[13px] text-muted-foreground">Point Loop QA at a URL. It explores the app, maps its pages, and starts filing bugs — no test code needed.</p>
      <TextField className={field} value={url} onChange={setUrl} autoFocus><Label>App URL</Label><Input size="sm" placeholder="https://app.example.com" className="font-mono text-[13px]" /></TextField>
      <TextField className={field}><Label>Name (optional)</Label><Input size="sm" placeholder="Taken from the page title" className="text-[14px]" /></TextField>
      <Button type="submit" className="mt-1 h-10 rounded-[11px]" isDisabled={!/^https?:\/\/\S+\.\S+/.test(url)}>Create and explore</Button>
    </form>
  );
}
