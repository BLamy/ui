/* Share Contact: a Credenza (dialog on wide screens, tray on phones) whose views morph — pick a method, then
   the QR code or the vCard, then a confirmation. */
import { Button, Card, Credenza, Haptics, Icon, ListRow, ListSection, QRSvg } from '@brett_lamy/ui';
import type { Contact } from './data';

export type ShareView = 'menu' | 'qr' | 'vcard' | 'done';

const TITLES: Record<ShareView, string> = { menu: 'Share Contact', qr: 'QR Code', vcard: 'Export vCard', done: 'Shared' };

function ShareBody({ c, view, go, onClose }: { c: Contact; view: ShareView; go: (v: ShareView) => void; onClose: () => void }) {
  if (view === 'qr') {
    return (
      <div className="px-5 pt-3 pb-5 text-center">
        <div className="inline-grid place-items-center rounded-[20px] bg-white p-4 text-[#111] shadow-[0_0_0_1px_var(--border)]">
          <QRSvg seed={c.id} />
        </div>
        <p className="mx-0 mt-3 mb-3.5 text-[13px] leading-[1.45] text-muted-foreground">
          Scanning adds {c.f} {c.l} — name, {c.ph}, and email.
        </p>
        <Button size="pill" onPress={() => go('done')}>Save to Photos</Button>
      </div>
    );
  }
  if (view === 'vcard') {
    const fields = [['Name', `${c.f} ${c.l}`], ['Mobile', c.ph], ['Email', c.em], ['Group', c.g || '—']];
    return (
      <div className="px-4 pt-3 pb-4">
        <Card className="mb-3 bg-secondary">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-3.5 py-2 text-[13.5px] not-last:shadow-[inset_0_-1px_0_var(--border)]">
              <span className="shrink-0 text-muted-foreground">{k}</span>
              <span className="truncate font-semibold">{v}</span>
            </div>
          ))}
        </Card>
        <p className="mx-0.5 mt-0 mb-3 text-[12.5px] text-muted-foreground">Everything on the card ships in one .vcf file.</p>
        <Button size="pill" onPress={() => go('done')}>{`Export ${c.f}.vcf`}</Button>
      </div>
    );
  }
  if (view === 'done') {
    return (
      <div className="px-5 pt-[18px] pb-[22px] text-center">
        <span className="mb-2.5 inline-grid size-[54px] place-items-center rounded-full bg-success text-white"><Icon name="check" size={26} sw={3} /></span>
        <div className="text-[17px] font-bold">Card shared</div>
        <p className="mx-0 mt-1 mb-4 text-[13px] text-muted-foreground">{c.f} {c.l} is on the way.</p>
        <Button size="pill" onPress={onClose}>Done</Button>
      </div>
    );
  }
  const options: [ShareView, string, string, string][] = [
    ['qr', 'pulse', 'QR Code', 'Scan in person'],
    ['vcard', 'mail', 'Export vCard', 'Send the .vcf anywhere'],
    ['done', 'link', 'Copy Link', `blui.app/c/${c.id}`],
  ];
  return (
    <div className="px-4 pt-2.5 pb-1">
      <p className="mx-0.5 mt-0 mb-2.5 text-[13px] text-muted-foreground">Pick how to share {c.f}’s card.</p>
      <ListSection>
        {options.map(([to, icon, title, detail], i) => (
          <ListRow key={to} title={title} subtitle={detail} accessory="chevron" divider={i < options.length - 1} onPress={() => go(to)}
            leading={<span className="grid size-[34px] place-items-center rounded-[10px] bg-secondary text-primary"><Icon name={icon} size={18} sw={2} /></span>} />
        ))}
      </ListSection>
    </div>
  );
}

export function ShareSheet({ contact, view, onViewChange, compact }: {
  contact: Contact | null; view: ShareView | null; onViewChange: (v: ShareView | null) => void; compact: boolean;
}) {
  const go = (v: ShareView) => {
    if (v === 'done') Haptics.notification('success');
    else Haptics.selection();
    onViewChange(v);
  };
  const v = view ?? 'menu';
  return (
    <Credenza open={!!(view && contact)} compact={compact} view={v} title={TITLES[v]}
      canBack={v === 'qr' || v === 'vcard'} onBack={() => go('menu')} onClose={() => onViewChange(null)}>
      {contact ? <ShareBody c={contact} view={v} go={go} onClose={() => onViewChange(null)} /> : null}
    </Credenza>
  );
}
