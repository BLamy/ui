/* The list and message columns (the mailboxes column lives in mailboxes.tsx). The same columns serve every
   width: on the phone SplitView stacks them, the headers trade their leading items for a back button, and the
   message's actions move to a bottom bar. */
import { SearchField } from '@/components/ui/search-field';
import { SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { MessageList } from './message-list';
import { MessageView, NoMessage } from './message-view';
import { BarButton, BottomBar, FlagButton, ListBar, MoveMenu, ReplyMenu } from './parts';
import type { MailState } from './use-mail';

export function ListColumn({ mail }: { mail: MailState }) {
  const s = useSplitView();
  const all = mail.checked.size === mail.list.length && mail.list.length > 0;
  return (
    <SplitViewSupplementary aria-label={mail.box.title} width={380} minWidth={300}>
      <SplitViewHeader largeTitle title={mail.editing && mail.checked.size ? `${mail.checked.size} Selected` : mail.box.title}
        leading={mail.editing ? <BarButton label={all ? 'Deselect All' : 'Select All'} onPress={mail.checkAll} /> : <SplitViewToggle />}
        trailing={<BarButton label={mail.editing ? 'Done' : 'Edit'} className={mail.editing ? 'font-semibold' : undefined}
          onPress={() => mail.setEditing(!mail.editing)} />} />
      <SplitViewContent>
        <div className="px-4 pb-2"><SearchField value={mail.query} onChange={mail.setQuery} aria-label={`Search ${mail.box.title}`} /></div>
        <MessageList mail={mail} onOpen={(id) => { mail.open(id); s.select('supplementary', id); }} />
      </SplitViewContent>
      <ListBar mail={mail} />
    </SplitViewSupplementary>
  );
}

export function MessageColumn({ mail }: { mail: MailState }) {
  const s = useSplitView();
  const m = mail.selected;
  const i = m ? mail.list.findIndex((x) => x.id === m.id) : -1;
  // On the phone, a message that leaves the mailbox takes you back to the list.
  const done = () => { if (s.collapsed) s.back(); };
  const compose = <BarButton label="New message" onPress={() => mail.compose('new')}><Icon name="compose" /></BarButton>;
  const stepper = m ? <>
    <BarButton label="Previous message" isDisabled={i <= 0} onPress={() => mail.step(-1)}><Icon name="chevron-up" /></BarButton>
    <BarButton label="Next message" isDisabled={i < 0 || i >= mail.list.length - 1} onPress={() => mail.step(1)}><Icon name="chevron-down" /></BarButton>
  </> : null;
  return (
    <SplitViewDetail aria-label="Message">
      <SplitViewHeader leading={stepper}
        trailing={s.collapsed ? stepper : m ? <>
          <FlagButton mail={mail} m={m} />
          <MoveMenu mail={mail} ids={[m.id]} />
          <BarButton label="Archive" onPress={() => mail.archive([m.id])}><Icon name="archivebox" /></BarButton>
          <BarButton label="Trash" onPress={() => mail.trash([m.id])}><Icon name="trash" /></BarButton>
          <ReplyMenu mail={mail} m={m} />
          {compose}
        </> : compose} />
      {m ? (
        <SplitViewContent key={m.id}>
          <MessageView m={m} />
        </SplitViewContent>
      ) : <NoMessage count={mail.list.length} />}
      {s.collapsed && m ? (
        <BottomBar className="justify-between px-3">
          <FlagButton mail={mail} m={m} />
          <MoveMenu mail={mail} ids={[m.id]} onMoved={done} />
          <BarButton label="Trash" onPress={() => { mail.trash([m.id]); done(); }}><Icon name="trash" /></BarButton>
          <ReplyMenu mail={mail} m={m} />
          {compose}
        </BottomBar>
      ) : null}
    </SplitViewDetail>
  );
}
