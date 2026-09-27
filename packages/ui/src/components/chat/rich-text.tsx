import { Fragment } from 'react';
import { useChatUsers, type ChatUsers } from '../../lib/chat/chat-users';

export interface RichTextProps {
  text: string;
  /** overrides the ChatUsersProvider context */
  users?: ChatUsers;
}

export function RichText({ text, users }: RichTextProps) {
  const ctxUsers = useChatUsers();
  const map = users ?? ctxUsers;
  const parts = text.split(/(@\w+)/g);
  return (
    <Fragment>
      {parts.map((p, i) => {
        const m = p.match(/^@(\w+)$/);
        if (m && map[m[1]])
          return (
            <span
              key={i}
              data-slot="mention"
              className="rounded-[4px] bg-ck-mention px-[3px] py-0 font-semibold text-ck-link"
            >
              @{map[m[1]].name}
            </span>
          );
        return p;
      })}
    </Fragment>
  );
}
