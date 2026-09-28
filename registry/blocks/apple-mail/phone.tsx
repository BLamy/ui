/* iPhone: a NavigationStack — Mailboxes → a mailbox → a message — with large titles, the search field under
   the mailbox title, and bottom toolbars. Opens on the Inbox with Mailboxes one step back, as Mail does. */
import { useState } from 'react';
import { NavigationStack, SearchField, type Screen } from '@brett_lamy/ui';
import { G } from './glyphs';
import { MailboxesList } from './mailboxes';
import { MessageList } from './message-list';
import { MessageView } from './message-view';
import { BarButton, BottomBar, FlagButton, ListBar, MoveMenu, ReplyMenu } from './parts';
import type { MailState } from './use-mail';

export function PhoneMail({ mail, initialDepth = 1 }: { mail: MailState; initialDepth?: number }) {
  const [depth, setDepth] = useState(initialDepth);
  const m = mail.selected;
  const screens: Screen[] = [{
    key: 'mailboxes', title: 'Mailboxes', largeTitle: true, grouped: true,
    trailing: <BarButton label="Edit" />,
    content: <MailboxesList mail={mail} onOpen={() => setDepth(1)} />,
  }];
  if (depth >= 1) screens.push({
    key: `box-${mail.boxId}`, title: mail.editing && mail.checked.size ? `${mail.checked.size} Selected` : mail.box.title, largeTitle: true,
    subheader: <SearchField value={mail.query} onChange={mail.setQuery} aria-label={`Search ${mail.box.title}`} />,
    trailing: <BarButton label={mail.editing ? 'Done' : 'Edit'} className={mail.editing ? 'font-semibold' : undefined}
      onPress={() => mail.setEditing(!mail.editing)} />,
    content: <MessageList mail={mail} selectable={false} largeTitle={false} onOpen={(id) => { mail.open(id); setDepth(2); }} />,
    overlay: <ListBar mail={mail} />,
    bottomInset: 50,
    hideChromeOnScroll: false,
  });
  if (depth >= 2 && m) screens.push({
    key: `message-${m.id}`, title: '',
    trailing: <>
      <BarButton label="Previous message" onPress={() => mail.step(-1)}><G name="up" /></BarButton>
      <BarButton label="Next message" onPress={() => mail.step(1)}><G name="down" /></BarButton>
    </>,
    content: <MessageView m={m} />,
    overlay: (
      <BottomBar className="justify-between px-3">
        <FlagButton mail={mail} m={m} />
        <MoveMenu mail={mail} ids={[m.id]} onMoved={() => setDepth(1)} />
        <BarButton label="Trash" onPress={() => { mail.trash([m.id]); setDepth(1); }}><G name="trash" /></BarButton>
        <ReplyMenu mail={mail} m={m} />
        <BarButton label="New message" onPress={() => mail.compose('new')}><G name="compose" /></BarButton>
      </BottomBar>
    ),
    bottomInset: 50,
    hideChromeOnScroll: false,
  });
  return <NavigationStack screens={screens} onPop={() => { setDepth((d) => Math.max(0, d - 1)); if (mail.editing) mail.setEditing(false); }} />;
}
