import { useEffect, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { SqlConsole, SqlConsoleDatabaseMenu, SqlConsoleEditor, SqlConsoleHeader, SqlConsoleResults } from '@/components/ui/sql-console';
import { PGliteProvider, useDatabaseStatus } from '@/lib/pglite';
import type { Migration } from '@/lib/pglite-core';
import { Panel } from '../stories/primitive-frame';

/* These stories start a real PGlite (a ~10 MB WebAssembly module) in memory. `autoRun` and `timing={false}` make
   each screen reproducible: the query runs once the database is ready and no millisecond counts are shown. They
   mark `data-pglite-ready` on the body when the first result is on screen so screenshot tools can wait for it. */

const seed: Migration[] = [
  {
    id: '001',
    sql: `create table authors (id serial primary key, name text not null, born date);
          create table books (id serial primary key, title text not null, author_id int references authors (id), price numeric(8, 2) not null, tags text[] not null default '{}', meta jsonb);
          create view cheap_books as select id, title, price from books where price < 15;
          insert into authors (name, born) values ('Ursula K. Le Guin', '1929-10-21'), ('Octavia E. Butler', '1947-06-22'), ('Stanislaw Lem', '1921-09-12');
          insert into books (title, author_id, price, tags, meta) values
            ('A Wizard of Earthsea', 1, 12.50, '{fantasy,classic}', '{"pages": 183}'),
            ('The Left Hand of Darkness', 1, 14.99, '{sci-fi}', '{"pages": 304}'),
            ('Kindred', 2, 13.25, '{sci-fi,time-travel}', null),
            ('Solaris', 3, 11.75, '{sci-fi,philosophy}', '{"pages": 204}');`,
  },
];

const query = `select a.name, count(*)::int as books, round(avg(b.price), 2) as avg_price
from authors a
join books b on b.author_id = a.id
group by a.name
order by books desc, a.name;`;

/** Flags the document once a result or an error is showing, for screenshot tools. */
function Ready({ children }: { children?: ReactNode }) {
  const { status } = useDatabaseStatus();
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setInterval(() => {
      if (document.querySelector('[data-slot=sql-console-results], [data-slot=sql-console-error]')) {
        document.body.dataset.pgliteReady = 'true';
        clearInterval(t);
      }
    }, 50);
    return () => clearInterval(t);
  }, [status]);
  return children;
}

function Frame({ w = 1000, dark, children }: { w?: number; dark?: boolean; children?: ReactNode }) {
  return (
    <Panel w={w} dark={dark}>
      <PGliteProvider migrations={seed}>
        <Ready>{children}</Ready>
      </PGliteProvider>
    </Panel>
  );
}

const meta: Meta<typeof SqlConsole> = {
  title: 'Organisms/SqlConsole',
  component: SqlConsole,
  parameters: { layout: 'padded' },
  render: (args) => <Frame><SqlConsole {...args} /></Frame>,
};
export default meta;
type Story = StoryObj<typeof SqlConsole>;

export const Default: Story = { args: { defaultValue: query, autoRun: true, timing: false } };
export const MultipleStatements: Story = {
  args: { defaultValue: "select count(*)::int as books from books;\nselect title, price, tags, meta from books order by id;", autoRun: true, timing: false },
};
export const WriteResult: Story = {
  args: { defaultValue: "create table notes (id serial primary key, body text);\ninsert into notes (body) values ('hello'), ('world');", autoRun: true, timing: false },
};
export const QueryError: Story = {
  args: { defaultValue: 'select 1;\nselect * from boooks;', autoRun: true, timing: false },
};
/** An empty result: the table's EmptyState under its typed headers. */
export const NoRows: Story = {
  args: { defaultValue: 'select title, price from books where price > 100;', autoRun: true, timing: false },
};
/** Composed from its parts: no sidebar, so one column at any width, and a header with a control of your own. */
export const WithoutSidebar: Story = {
  render: (args) => (
    <Frame w={720}>
      <SqlConsole {...args}>
        <SqlConsoleHeader>
          <Button size="sm" variant="ghost">Help</Button>
          <SqlConsoleDatabaseMenu />
        </SqlConsoleHeader>
        <SqlConsoleEditor rows={4} />
        <SqlConsoleResults />
      </SqlConsole>
    </Frame>
  ),
  args: { defaultValue: query, autoRun: true, timing: false },
};
/** Its own width, not the viewport's: a phone-sized console is one column, and the result table stacks its rows. */
export const Compact: Story = {
  render: (args) => <Frame w={390}><SqlConsole {...args} /></Frame>,
  args: { defaultValue: query, autoRun: true, timing: false },
};
export const Dark: Story = {
  render: (args) => <Frame dark><SqlConsole {...args} /></Frame>,
  args: { defaultValue: query, autoRun: true, timing: false },
};
