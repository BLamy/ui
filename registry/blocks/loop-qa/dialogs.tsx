/* The block's dialogs — Share, Project settings, Connect issue tracker and New project — are views of one
   Credenza (a centred dialog, or a bottom tray on a phone): switching between them morphs the card's height and
   slides the views, and the tracker view is one step "into" settings, so it comes back the way it went. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Credenza, CredenzaBack, CredenzaBackdrop, CredenzaClose, CredenzaContent, CredenzaHeader, CredenzaTitle, CredenzaView,
} from '@/components/ui/credenza';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { List, ListRow } from '@/components/ui/list';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MemberPreview } from './cards';
import { MEMBERS, PROJECTS, TRACKERS, host } from './data';
import { Avatar } from './parts';
import { useLoopQA, type DialogName } from './state';

const TITLES: Record<Exclude<DialogName, null>, string> = {
  share: 'Share project', settings: 'Project settings', tracker: 'Connect issue tracker', 'new-project': 'New project',
};

/** The views in a centred card, or in a bottom tray when the block is phone-sized (Credenza's `auto`, from the
    block's size-class scope). */
export function Dialogs() {
  const qa = useLoopQA();
  const [last, setLast] = useState<Exclude<DialogName, null>>('share');
  const view = qa.dialog ?? last;
  if (qa.dialog && qa.dialog !== last) setLast(qa.dialog);
  return (
    <Credenza open={!!qa.dialog} onOpenChange={(o) => { if (!o) qa.setDialog(null); }} view={view}>
      <CredenzaBackdrop />
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaBack hidden={view !== 'tracker'} onClick={() => qa.setDialog('settings')} />
          <CredenzaTitle>{TITLES[view]}</CredenzaTitle>
          <CredenzaClose />
        </CredenzaHeader>
        <CredenzaView>
          <div className="px-4 pt-1 pb-4">
            {view === 'share' ? <Share /> : view === 'settings' ? <Settings /> : view === 'tracker' ? <Trackers /> : <NewProject />}
          </div>
        </CredenzaView>
      </CredenzaContent>
    </Credenza>
  );
}

/** The small grey caption over each settings field. */
const caption = 'text-[12.5px] font-medium text-muted-foreground';

function Share() {
  const qa = useLoopQA();
  const p = qa.project ?? PROJECTS[0]!;
  const [publicReplays, setPublic] = useState(true);
  const link = `https://loopqa.dev/p/${p.id}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-10 items-center gap-2 rounded-ctl bg-secondary pr-1 pl-3">
        <Icon name="link" size={14} sw={2} className="shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{link}</code>
        <Button size="sm" className="h-8 rounded-lg" onClick={() => qa.copy(link, 'Copied project link')}>Copy</Button>
      </div>
      <List className="overflow-hidden rounded-xl border border-border">
        <ListRow title="Public replays" subtitle="Anyone with a bug's link can watch its replay" divider={false}
          className="[&_[data-slot=list-row-content]]:text-detail" trailing={<Switch checked={publicReplays} onCheckedChange={setPublic} />} />
      </List>
      <div>
        <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">Members</div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {p.members.map((m, i) => (
            <li key={m} className="flex items-center gap-2.5">
              <MemberPreview initials={m} tone={i} render={<Avatar initials={m} tone={i} aria-label={MEMBERS[m]?.name ?? m} />} />
              <span className="flex-1 text-[13.5px]">{MEMBERS[m]?.name ?? m}</span>
              <span className="text-caption text-muted-foreground">{i === 0 ? 'Owner' : 'Member'}</span>
            </li>
          ))}
        </ul>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); qa.toast.success('Invite sent'); }}>
        <Input size="sm" type="email" aria-label="Invite by email" placeholder="teammate@company.com" className="flex-1 text-detail" />
        <Button size="sm" type="submit" className="h-8 rounded-[9px]">Invite</Button>
      </form>
    </div>
  );
}

function Settings() {
  const qa = useLoopQA();
  const p = qa.project ?? PROJECTS[0]!;
  const [schedule, setSchedule] = useState('6h');
  const [active, setActive] = useState(p.status === 'active');
  const tracker = TRACKERS.find((t) => qa.trackers.includes(t.id));
  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); qa.setDialog(null); qa.toast.success('Settings saved'); }}>
      <Field><FieldLabel className={caption}>Name</FieldLabel><Input size="sm" defaultValue={p.name} className="text-detail" /></Field>
      <Field><FieldLabel className={caption}>Target URL</FieldLabel><Input size="sm" defaultValue={p.url} className="font-mono text-footnote" /></Field>
      <Field>
        <FieldLabel className={caption}>Bug webhook</FieldLabel>
        <Input size="sm" defaultValue={`https://hooks.${host(p.url).replace(/^[^.]+\./, '')}/loopqa`} className="font-mono text-footnote" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className={caption}>Test schedule</span>
        <Segmented aria-label="Test schedule" value={schedule} onValueChange={(v) => { if (v) setSchedule(v); }}>
          <SegmentedItem value="1h">Hourly</SegmentedItem>
          <SegmentedItem value="6h">6 hours</SegmentedItem>
          <SegmentedItem value="nightly">Nightly</SegmentedItem>
          <SegmentedItem value="deploy">Deploys</SegmentedItem>
        </Segmented>
      </div>
      <List className="overflow-hidden rounded-xl border border-border">
        <ListRow title="Active" subtitle={active ? 'Runs on schedule and on deploys' : 'Paused — no runs'} className="[&_[data-slot=list-row-content]]:text-detail"
          trailing={<Switch checked={active} onCheckedChange={setActive} />} />
        <ListRow title="Issue tracker" subtitle={tracker ? `${tracker.name} · connected` : 'Not connected'} accessory="chevron" divider={false}
          className="[&_[data-slot=list-row-content]]:text-detail" onClick={() => qa.setDialog('tracker')} />
      </List>
      <Button type="submit" className="mt-1 h-10 rounded-[11px]">Save changes</Button>
    </form>
  );
}

function Trackers() {
  const qa = useLoopQA();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-footnote text-muted-foreground">File new bugs automatically, with the replay, the chronology and the root cause attached.</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {TRACKERS.map((t) => {
          const on = qa.trackers.includes(t.id);
          return (
            <li key={t.id} className="flex items-center gap-3 rounded-panel border border-border px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-(--c) text-footnote font-bold text-white" style={{ '--c': t.color } as React.CSSProperties}>{t.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{t.name}</span>
                <span className="block truncate text-caption text-muted-foreground">{t.detail}</span>
              </span>
              <Button size="sm" variant={on ? 'secondary' : 'default'} className={cn('h-8 min-w-[92px] rounded-[9px]', on && 'text-success')}
                disabled={on} onClick={() => qa.connectTracker(t.id, t.name)}>
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
      <p className="m-0 text-footnote text-muted-foreground">Point Loop QA at a URL. It explores the app, maps its pages, and starts filing bugs — no test code needed.</p>
      <Field>
        <FieldLabel className={caption}>App URL</FieldLabel>
        <Input size="sm" value={url} onValueChange={setUrl} autoFocus placeholder="https://app.example.com" className="font-mono text-footnote" />
      </Field>
      <Field><FieldLabel className={caption}>Name (optional)</FieldLabel><Input size="sm" placeholder="Taken from the page title" className="text-detail" /></Field>
      <Button type="submit" className="mt-1 h-10 rounded-[11px]" disabled={!/^https?:\/\/\S+\.\S+/.test(url)}>Create and explore</Button>
    </form>
  );
}
