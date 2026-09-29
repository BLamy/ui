/* The detail column: an account (username, password, passkey, verification code, websites, notes, edit
   mode), a security recommendation on top of its account, a deleted item, or a Wi-Fi network with its QR code. */
import { useState, type ReactNode } from 'react';
import {
  AnimatedHeight, Button, Haptics, Icon, Input, QRSvg, SplitViewContent, SplitViewEmpty, SplitViewHeader, Textarea, cn,
} from '@brett_lamy/ui';
import { GROUPS, SEVERITY, type Account, type WifiNetwork } from './data';
import {
  Card, CodeValue, CopyButton, DetailHeader, Field, PasswordValue, RevealButton, SiteTile, WifiTile, useCode, type CodeClock,
} from './parts';
import type { Entry, Vault } from './vault';

export function Detail({ entry, vault, now, editing, onEditing }: {
  entry: Entry | null; vault: Vault; now: CodeClock; editing: boolean; onEditing: (on: boolean) => void;
}) {
  if (!entry) {
    return (
      <>
        <SplitViewHeader />
        <SplitViewEmpty icon={<Icon name="key" size={40} />} title="No Selection" description="Choose an item to see its details." />
      </>
    );
  }
  if (entry.kind === 'wifi') return <WifiDetail key={entry.id} network={entry.wifi!} />;
  return (
    <AccountDetail key={entry.id} account={entry.account!} deleted={entry.kind === 'deleted'} vault={vault} now={now}
      editing={editing} onEditing={onEditing} />
  );
}

/* A centred, readable column inside the detail; `@container` drives the label-beside/label-above rows. */
function Page({ children }: { children: ReactNode }) {
  return (
    <SplitViewContent className="bg-muted">
      <div className="@container mx-auto flex max-w-[680px] flex-col gap-5 px-4 pb-10 @md:px-8">{children}</div>
    </SplitViewContent>
  );
}

function AccountDetail({ account: a, deleted, vault, now, editing, onEditing }: {
  account: Account; deleted: boolean; vault: Vault; now: CodeClock; editing: boolean; onEditing: (on: boolean) => void;
}) {
  const [draft, setDraft] = useState(a);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const revealed = pinned || hover;
  const group = GROUPS.find((g) => g.id === a.group);
  const { code } = useCode(a.otp ?? '', now);
  const edit = editing && !deleted;

  const toggleEdit = () => {
    if (edit) {
      vault.update(a.id, {
        title: draft.title.trim() || a.title, username: draft.username, password: draft.password,
        websites: draft.websites.map((w) => w.trim()).filter(Boolean), notes: draft.notes,
      });
      Haptics.notification('success');
    } else {
      setDraft(a);
      Haptics.impact('light');
    }
    onEditing(!edit);
  };

  return (
    <>
      <SplitViewHeader
        trailing={deleted ? null : (
          <Button variant={edit ? 'default' : 'ghost'} size="sm" onPress={toggleEdit} className={cn('mr-1 min-w-[58px]', !edit && 'text-primary')}>
            {edit ? 'Done' : 'Edit'}
          </Button>
        )} />
      <Page>
        <DetailHeader
          icon={<SiteTile title={draft.title || a.title} color={a.color} size={64} className={cn(deleted && 'grayscale')} />}
          title={edit ? (
            <Input aria-label="Title" size="sm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="h-9 bg-card text-center text-[22px] font-bold" />
          ) : a.title}
          subtitle={deleted ? `Deleted · ${a.deleted}` : `Last modified ${a.modified}`}
        />

        {deleted ? (
          <Card className="flex flex-col gap-3 p-4">
            <div className="text-[14px] text-muted-foreground">
              Recently deleted passwords can be recovered for 30 days. After that, they’re permanently removed from all your devices.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onPress={() => { vault.recover(a.id); Haptics.notification('success'); }}>Recover</Button>
              <Button size="sm" variant="secondary" className="text-destructive"
                onPress={() => { vault.purge(a.id); Haptics.notification('warning'); }}>Delete Now</Button>
            </div>
          </Card>
        ) : null}

        {a.issue && !deleted ? <IssueCard account={a} /> : null}

        <Card>
          <Field label="User Name" trailing={!edit ? <CopyButton label="User Name" value={a.username} /> : null}>
            {edit ? <InlineInput label="User Name" value={draft.username} onChange={(v) => setDraft({ ...draft, username: v })} /> : <span className="select-text">{a.username}</span>}
          </Field>
          {a.password != null ? (
            <Field label="Password" last={!a.passkey && !a.otp && !edit}
              trailing={!edit ? (
                <>
                  <RevealButton revealed={pinned} onToggle={() => setPinned((p) => !p)} />
                  <CopyButton label="Password" value={a.password} />
                </>
              ) : null}>
              {edit ? (
                <InlineInput label="Password" mono value={draft.password ?? ''} onChange={(v) => setDraft({ ...draft, password: v })} />
              ) : (
                <span onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)} onPointerLeave={() => setHover(false)}>
                  <PasswordValue password={a.password} revealed={revealed} />
                </span>
              )}
            </Field>
          ) : null}
          {a.passkey ? (
            <Field label="Passkey" last={!a.otp && !edit}>
              <span className="inline-flex items-center gap-1.5"><Icon name="passkey" size={17} className="text-success" />Created {a.passkey}</span>
            </Field>
          ) : null}
          {a.otp ? (
            <Field label="Verification Code" last={!edit}
              trailing={!edit ? <CopyButton label="Code" value={String(code).padStart(6, '0')} /> : null}>
              <CodeValue seed={a.otp} now={now} />
            </Field>
          ) : edit ? (
            <Field label="Verification Code" last>
              <button type="button" className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-[15px] text-primary">Set Up Verification Code…</button>
            </Field>
          ) : null}
        </Card>

        <Section title="Websites">
          <Card>
            {(edit ? draft.websites : a.websites).map((w, i, list) => (
              <Field key={i} label={i === 0 ? 'Website' : ''} last={i === list.length - 1 && !edit}>
                {edit ? (
                  <span className="flex items-center gap-2">
                    <button type="button" aria-label={`Remove ${w || 'website'}`}
                      onClick={() => { Haptics.impact('light'); setDraft({ ...draft, websites: draft.websites.filter((_, j) => j !== i) }); }}
                      className="bl-btn grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-destructive p-0 text-white">
                      <span className="h-[2px] w-2.5 rounded-full bg-white" />
                    </button>
                    <InlineInput label="Website" value={w} onChange={(v) => setDraft({ ...draft, websites: draft.websites.map((x, j) => (j === i ? v : x)) })} />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-primary"><Icon name="globe" size={15} />{w}</span>
                )}
              </Field>
            ))}
            {edit ? (
              <Field label="" last>
                <button type="button" onClick={() => setDraft({ ...draft, websites: [...draft.websites, ''] })}
                  className="bl-btn inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 [font-family:inherit] text-[15px] text-primary">
                  <span className="grid size-5 place-items-center rounded-full bg-success text-white"><Icon name="plus" size={13} sw={3} /></span>
                  Add Website
                </button>
              </Field>
            ) : null}
          </Card>
        </Section>

        <Section title="Notes">
          <Card className={cn(edit ? 'p-2' : 'px-4 py-3')}>
            {edit ? (
              <Textarea aria-label="Notes" size="sm" value={draft.notes ?? ''} placeholder="Add Notes"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="bg-transparent" />
            ) : (
              <div className={cn('text-[15px] whitespace-pre-wrap select-text', !a.notes && 'text-tertiary-foreground')}>{a.notes || 'No notes'}</div>
            )}
          </Card>
        </Section>

        {!deleted ? (
          <Section title="Groups">
            <Card>
              <Field label="Shared In" last>
                {group ? (
                  <span className="inline-flex items-center gap-1.5"><Icon name="people" size={16} className="text-primary" />{group.name} · {group.members.length + 1} people</span>
                ) : <span className="text-muted-foreground">Only You</span>}
              </Field>
            </Card>
          </Section>
        ) : null}

        <AnimatedHeight>
          {edit ? (
            <Button variant="secondary" size="pill" className="bg-card text-destructive"
              onPress={() => { vault.remove(a.id); onEditing(false); Haptics.notification('warning'); }}>
              Delete Password
            </Button>
          ) : null}
        </AnimatedHeight>
      </Page>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="m-0 px-4 text-[13px] font-semibold text-muted-foreground @md:px-1">{title}</h3>
      {children}
    </section>
  );
}

function InlineInput({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <Input aria-label={label} size="sm" value={value} onChange={(e) => onChange(e.target.value)}
      className={cn('-my-1 h-8 bg-secondary px-2 text-[15px]', mono && 'font-mono')} />
  );
}

function IssueCard({ account: a }: { account: Account }) {
  const s = SEVERITY[a.issue!.severity];
  return (
    <Card className="flex gap-3 p-4" >
      <Icon name="warning-fill" size={26} style={{ color: s.color }} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{a.issue!.kind}</div>
        <div className="mt-1 text-[13.5px] leading-[1.45] text-muted-foreground">{a.issue!.detail}</div>
        <Button size="sm" className="mt-3" onPress={() => Haptics.impact('light')}>Change Password on {a.websites[0]}</Button>
      </div>
      <span className="h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[.3px] uppercase"
        style={{ color: s.badge, background: `color-mix(in oklab, ${s.color} 16%, transparent)` }}>
        {a.issue!.severity}
      </span>
    </Card>
  );
}

function WifiDetail({ network: n }: { network: WifiNetwork }) {
  const [pinned, setPinned] = useState(false);
  const [qr, setQr] = useState(false);
  return (
    <>
      <SplitViewHeader />
      <Page>
        <DetailHeader
          icon={<WifiTile size={64} />}
          title={n.ssid} subtitle={`Last modified ${n.modified}`} />
        <Card>
          <Field label="Network Name" trailing={<CopyButton label="Network Name" value={n.ssid} />}>{n.ssid}</Field>
          <Field label="Password"
            trailing={<><RevealButton revealed={pinned} onToggle={() => setPinned((p) => !p)} /><CopyButton label="Password" value={n.password} /></>}>
            <PasswordValue password={n.password} revealed={pinned} />
          </Field>
          <Field label="Security" last>{n.security}</Field>
        </Card>
        <Card>
          <button type="button" aria-expanded={qr}
            onClick={() => { Haptics.impact('light'); setQr((v) => !v); }}
            className="bl-btn flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left [font-family:inherit] text-[15px] text-primary">
            <Icon name="qrcode" size={20} />
            <span className="flex-1">{qr ? 'Hide Network QR Code' : 'Show Network QR Code'}</span>
            <Icon name="chevron-right" size={15} weight="bold" className={cn('text-tertiary-foreground transition-transform duration-spring-snappy ease-spring-snappy', qr && 'rotate-90')} />
          </button>
          <AnimatedHeight>
            {qr ? (
              <div className="flex flex-col items-center gap-3 px-4 pt-1 pb-5 text-center">
                <div className="rounded-[18px] bg-white p-4 text-black shadow-[0_0_0_.5px_black] shadow-black/12">
                  <QRSvg seed={`WIFI:S:${n.ssid};T:WPA;P:${n.password};;`} size={184} />
                </div>
                <div className="max-w-[300px] text-[13px] text-muted-foreground">
                  Point another device’s camera at this code to join “{n.ssid}”.
                </div>
              </div>
            ) : null}
          </AnimatedHeight>
        </Card>
      </Page>
    </>
  );
}
