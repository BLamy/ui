import { Fragment } from 'react';
import { useChatUsers, type ChatUsers } from './chat-users';

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
              className="rounded-sm bg-primary/12 dark:bg-primary/16 px-[3px] py-0 font-semibold text-link"
            >
              @{map[m[1]].name}
            </span>
          );
        return p;
      })}
    </Fragment>
  );
}
