import type { Migration } from '@/lib/pglite-core'

// A small bookshop: two tables, a foreign key, and one column of each kind the
// result table formats specially (numeric, date, timestamptz, text[], jsonb, bytea).
export const seed: Migration[] = [
  {
    id: '001_bookshop',
    sql: `
      create table authors (
        id serial primary key,
        name text not null,
        born date
      );
      create table books (
        id serial primary key,
        title text not null,
        author_id int references authors (id),
        price numeric(8, 2) not null,
        published date,
        tags text[] not null default '{}',
        meta jsonb,
        cover bytea,
        added_at timestamptz not null default '2026-01-02 03:04:05+00'
      );
      create view cheap_books as select id, title, price from books where price < 15;

      insert into authors (name, born) values
        ('Ursula K. Le Guin', '1929-10-21'),
        ('Octavia E. Butler', '1947-06-22'),
        ('Stanislaw Lem', '1921-09-12'),
        ('Ted Chiang', '1967-10-20');

      insert into books (title, author_id, price, published, tags, meta, cover) values
        ('A Wizard of Earthsea', 1, 12.50, '1968-11-01', '{fantasy,classic}', '{"pages": 183, "series": "Earthsea"}', '\\x89504e47'),
        ('The Left Hand of Darkness', 1, 14.99, '1969-03-01', '{sci-fi,classic}', '{"pages": 304, "awards": ["Hugo", "Nebula"]}', null),
        ('Kindred', 2, 13.25, '1979-06-01', '{sci-fi,time-travel}', '{"pages": 287}', null),
        ('Parable of the Sower', 2, 16.00, '1993-10-01', '{sci-fi,dystopia}', '{"pages": 345, "series": "Earthseed"}', null),
        ('Solaris', 3, 11.75, '1961-01-01', '{sci-fi,philosophy}', null, null),
        ('The Cyberiad', 3, 15.50, '1965-01-01', '{sci-fi,satire}', '{"pages": 295}', null),
        ('Stories of Your Life and Others', 4, 17.99, '2002-02-01', '{short-stories,sci-fi}', '{"pages": 281, "awards": ["Nebula"]}', null),
        ('Exhalation', 4, 18.00, '2019-05-07', '{short-stories}', '{"pages": 368}', null);
    `,
  },
]

export const starter = `-- ⌘/Ctrl + Enter runs the selection, or everything.
select a.name, count(*)::int as books, round(avg(b.price), 2) as avg_price
from authors a
join books b on b.author_id = a.id
group by a.name
order by books desc, a.name;
`
