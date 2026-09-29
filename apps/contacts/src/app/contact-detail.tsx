/* The contact column: the card (actions, details, ringtone, favorite, notes) and its Activity panel, which
   docks beside the card on extra-wide windows and slides over it everywhere else. */
import type { ReactNode } from 'react';
import {
  Avatar, Button, Card, Haptics, Icon, ListRow, ListSection, Select, SelectContent, SelectItem, SelectTrigger, SideDrawer,
  SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader, Switch, useSplitView,
} from '@brett_lamy/ui';
import { NOTES, RINGTONES, type Contact } from './data';
import type { ContactsState } from './use-contacts';

const ACTIONS = [
  ['message', 'Message'],
  ['phone', 'Call'],
  ['video', 'Video'],
  ['mail', 'Mail'],
] as const;

/** A row inside a Card: label on the left, a control or value on the right. */
function CardRow({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[46px] items-center gap-3 px-4 text-[17px] not-last:shadow-[inset_0_-1px_0_var(--border)]">{children}</div>;
}

function Field({ label, value, tint }: { label: string; value: ReactNode; tint?: boolean }) {
  return (
    <div className="px-4 py-2 not-last:shadow-[inset_0_-1px_0_var(--border)]">
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className={tint ? 'truncate text-[16.5px] text-primary' : 'truncate text-[16.5px]'}>{value}</div>
    </div>
  );
}

function ContactCard({ c, contacts, onShare }: { c: Contact; contacts: ContactsState; onShare: () => void }) {
  const fav = contacts.isFavorite(c.id);
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6">
      <div className="flex flex-col items-center pt-4 pb-5 text-center">
        <Avatar c={c} size={92} />
        <h1 className="m-0 mt-3 text-[26px] font-bold tracking-[-.3px]">{c.f} {c.l}</h1>
        <p className="m-0 mt-1 text-[14.5px] text-muted-foreground">{c.com ? `${c.role} · ${c.com}` : c.role}</p>
        <div className="mt-[18px] flex w-full max-w-[430px] gap-2.5">
          {ACTIONS.map(([icon, label]) => (
            <Button key={icon} variant="secondary" onPress={() => Haptics.impact('light')}
              className="h-auto flex-1 flex-col gap-1 rounded-xl bg-card py-2.5 text-[11.5px] font-normal text-primary">
              <Icon name={icon} size={20} />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="mb-[22px]">
        <Field label="mobile" value={c.ph} tint />
        <Field label="email" value={c.em} tint />
        {c.g ? <Field label="group" value={c.g} /> : null}
      </Card>

      <Card className="mb-[22px]">
        <CardRow>
          <Select aria-label="Ringtone" selectedKey={contacts.ringtone(c.id)}
            onSelectionChange={(k) => { if (k != null) { contacts.setRingtone(c.id, String(k)); Haptics.selection(); } }}
            className="flex-1 flex-row items-center justify-between gap-2">
            <span>Ringtone</span>
            <SelectTrigger variant="plain" className="text-[17px]" />
            <SelectContent>{RINGTONES.map((r) => <SelectItem key={r} id={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </CardRow>
        <CardRow>
          <Icon name={fav ? 'starF' : 'star'} size={21} className={fav ? 'text-[#FF9F0A]' : 'text-tertiary-foreground'} />
          <span className="flex-1">Favorite</span>
          <Switch aria-label="Favorite" checked={fav} onChange={(on) => contacts.setFavorite([c.id], on)} />
        </CardRow>
      </Card>

      <ListSection>
        <ListRow title="Share Contact" accessory="chevron" divider={false} onPress={() => { Haptics.impact('light'); onShare(); }} />
      </ListSection>

      {NOTES[c.id] ? (
        <Card className="mb-[22px] px-4 py-2.5">
          <div className="mb-1 text-[12.5px] text-muted-foreground">Notes</div>
          <p className="m-0 text-[15.5px] leading-[1.45]">{NOTES[c.id]}</p>
        </Card>
      ) : null}

      <ListSection>
        <ListRow title="Delete Contact" center destructive divider={false} onPress={() => contacts.remove([c.id])} />
      </ListSection>
    </div>
  );
}

/** Recent calls and messages with the contact (deterministic demo data), and their note. */
function Activity({ c }: { c: Contact }) {
  const log: [string, string, string][] = [
    ['phone', 'Outgoing call', '2 min · yesterday'], ['message', 'iMessage', '“see you at 6” · yesterday'],
    ['video', 'FaceTime', '12 min · Mon'], ['mail', 'Mail', 'Re: schedule · Mon'],
    ['phone', 'Missed call', 'Sun'], ['message', 'iMessage', 'photo · Sat'],
    ['phone', 'Incoming call', '6 min · Fri'], ['mail', 'Mail', 'Invite · last week'],
  ];
  const seed = [...(c.f + c.l)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
  const rows = Array.from({ length: 4 + (seed % 4) }, (_, i) => log[(seed + i * 3 + i * i) % log.length]);
  return (
    <div className="px-3.5 pt-1 pb-4">
      <div className="flex items-center gap-2.5 px-0.5 pt-2 pb-3.5">
        <Avatar c={c} size={34} />
        <div>
          <div className="text-[15px] font-bold">{c.f} {c.l}</div>
          <div className="text-[12px] text-muted-foreground">Last 30 days</div>
        </div>
      </div>
      <ListSection>
        {rows.map(([icon, title, detail], i) => (
          <ListRow key={i} title={title} subtitle={detail} divider={i < rows.length - 1}
            leading={<span className="grid size-[30px] place-items-center rounded-lg bg-secondary text-primary"><Icon name={icon} size={16} sw={2} /></span>} />
        ))}
      </ListSection>
      {NOTES[c.id] ? (
        <Card variant="outline" className="px-3 py-2.5">
          <div className="mb-1 text-[11.5px] font-bold tracking-[.4px] text-muted-foreground uppercase">Notes</div>
          <p className="m-0 text-[13.5px] leading-[1.5]">{NOTES[c.id]}</p>
        </Card>
      ) : null}
    </div>
  );
}

export function ContactDetail({ contacts, activity, onActivity, onShare }: {
  contacts: ContactsState; activity: boolean; onActivity: (open: boolean) => void; onShare: () => void;
}) {
  const s = useSplitView();
  const c = contacts.selected;
  const docked = s.width >= 1280;
  const panel = c ? <Activity c={c} /> : null;
  return (
    <SplitViewDetail aria-label="Contact" className="bg-muted">
      <SplitViewHeader title={c ? `${c.f} ${c.l}` : undefined}
        trailing={c ? (
          <Button variant="ghost" size="icon" aria-label="Activity" onPress={() => { Haptics.impact('light'); onActivity(!activity); }}
            className="rounded-[10px] text-primary data-hovered:bg-secondary">
            <Icon name="clock" size={22} sw={2} />
          </Button>
        ) : null} />
      {c ? (
        <div className="flex min-h-0 flex-1">
          <SplitViewContent key={c.id}>
            <ContactCard c={c} contacts={contacts} onShare={onShare} />
          </SplitViewContent>
          {docked ? <SideDrawer mode="fixed" open={activity} onClose={() => onActivity(false)} title="Activity" width={318}>{panel}</SideDrawer> : null}
        </div>
      ) : (
        <SplitViewEmpty icon={<Icon name="person" size={52} sw={1.2} />} title="No Contact Selected" description="Choose a contact from the list" />
      )}
      {!docked ? <SideDrawer mode="overlay" open={activity && !!c} onClose={() => onActivity(false)} title="Activity" width={340}>{panel}</SideDrawer> : null}
    </SplitViewDetail>
  );
}
