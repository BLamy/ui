/* The split layout's list and message columns (the mailboxes column lives in mailboxes.tsx). */
import {
  SearchField, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView,
} from '@brett_lamy/ui';
import { G } from './glyphs';
import { MessageList } from './message-list';
import { MessageView, NoMessage } from './message-view';
import { BarButton, FlagButton, ListBar, MoveMenu, ReplyMenu } from './parts';
import type { MailState } from './use-mail';

export function ListColumn({ mail }: { mail: MailState }) {
  const s = useSplitView();
  return (
    <SplitViewSupplementary aria-label={mail.box.title} width={380} minWidth={300}>
      <SplitViewHeader
        leading={mail.editing
          ? <BarButton label={mail.checked.size === mail.list.length && mail.list.length ? 'Deselect All' : 'Select All'} onPress={mail.checkAll} />
          : <SplitViewToggle />}
        title={mail.editing ? (mail.checked.size ? `${mail.checked.size} Selected` : 'Select Items') : undefined}
        trailing={<BarButton label={mail.editing ? 'Done' : 'Edit'} className={mail.editing ? 'font-semibold' : undefined}
          onPress={() => mail.setEditing(!mail.editing)} />}
        className="shadow-none" />
      <SplitViewContent>
        <MessageList mail={mail} selectable onOpen={(id) => { mail.open(id); s.select('supplementary', id); }}
          search={<div className="px-4 pb-2"><SearchField q={mail.query} setQ={mail.setQuery} aria-label={`Search ${mail.box.title}`} /></div>} />
      </SplitViewContent>
      <ListBar mail={mail} />
    </SplitViewSupplementary>
  );
}

export function MessageColumn({ mail }: { mail: MailState }) {
  const m = mail.selected;
  const i = m ? mail.list.findIndex((x) => x.id === m.id) : -1;
  return (
    <SplitViewDetail aria-label="Message">
      <SplitViewHeader
        leading={m ? <>
          <BarButton label="Previous message" isDisabled={i <= 0} onPress={() => mail.step(-1)}><G name="up" /></BarButton>
          <BarButton label="Next message" isDisabled={i < 0 || i >= mail.list.length - 1} onPress={() => mail.step(1)}><G name="down" /></BarButton>
        </> : null}
        trailing={m ? <>
          <FlagButton mail={mail} m={m} />
          <MoveMenu mail={mail} ids={[m.id]} />
          <BarButton label="Archive" onPress={() => mail.archive([m.id])}><G name="archive" /></BarButton>
          <BarButton label="Trash" onPress={() => mail.trash([m.id])}><G name="trash" /></BarButton>
          <ReplyMenu mail={mail} m={m} />
          <BarButton label="New message" onPress={() => mail.compose('new')}><G name="compose" /></BarButton>
        </> : <BarButton label="New message" onPress={() => mail.compose('new')}><G name="compose" /></BarButton>} />
      {m ? (
        <SplitViewContent key={m.id}>
          <MessageView m={m} />
        </SplitViewContent>
      ) : <NoMessage count={mail.list.length} />}
    </SplitViewDetail>
  );
}
