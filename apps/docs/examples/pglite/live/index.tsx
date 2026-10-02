import { PGliteProvider, useExec, useLiveQuery } from '@/lib/pglite'
import { Button } from '@/components/ui/button'

const migrations = [
  { id: '001_scores', sql: `create table scores (id serial primary key, player text not null, points int not null);
    insert into scores (player, points) values ('Ada', 31), ('Grace', 44), ('Linus', 12);` },
]

const players = ['Ada', 'Grace', 'Linus', 'Margaret', 'Edsger']

function Board() {
  // The live extension watches the tables this query reads and pushes a new
  // result whenever they change — including writes from anywhere else.
  const { rows, isLoading } = useLiveQuery<{ player: string; total: number }>(
    'select player, sum(points)::int as total from scores group by player order by total desc',
  )
  const { run } = useExec()
  return (
    <div className="grid gap-3">
      <ol className="grid gap-1.5" aria-busy={isLoading} aria-label="Leaderboard">
        {rows.map((r, i) => (
          <li key={r.player} className="flex items-center gap-3 rounded-ctl bg-card px-3 py-2 text-subhead shadow-hairline">
            <span className="w-5 text-foreground/65 tabular-nums">{i + 1}</span>
            <span className="flex-1">{r.player}</span>
            <span className="tabular-nums">{r.total}</span>
          </li>
        ))}
      </ol>
      <Button variant="secondary" onPress={() => void run('insert into scores (player, points) values ($1, $2)', [players[Math.floor(Math.random() * players.length)], 1 + Math.floor(Math.random() * 20)])}>
        Score some points
      </Button>
    </div>
  )
}

export default function Live() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <PGliteProvider migrations={migrations}>
        <Board />
      </PGliteProvider>
    </div>
  )
}
