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
              style={{
                background: 'rgba(10,132,255,.16)',
                color: '#7EB6FF',
                borderRadius: 4,
                padding: '0 3px',
                fontWeight: 600,
              }}
            >
              @{map[m[1]].name}
            </span>
          );
        return p;
      })}
    </Fragment>
  );
}
