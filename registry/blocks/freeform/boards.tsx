/* The board gallery: every board as a card with a live thumbnail, favorites, and a card to start a new one. */
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { boundsOf, unionRect } from './geometry';
import { ItemView } from './items';
import type { Board } from './model';
import { useFreeform } from './store';

const noop = () => undefined;

/** A board drawn small: its items, scaled to fit, not interactive. */
export function BoardThumb({ board }: { board: Board }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>(240);
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const box = unionRect(board.items.map((i) => boundsOf(i, byId)));
  const height = width * 0.75;
  const pad = 14;
  const k = box ? Math.min((width - pad * 2) / box.w, (height - pad * 2) / box.h) : 1;
  const tx = box ? (width - box.w * k) / 2 - box.x * k : 0;
  const ty = box ? (height - box.h * k) / 2 - box.y * k : 0;
  return (
    <div ref={ref} aria-hidden="true" className="relative aspect-[4/3] w-full overflow-hidden bg-background text-foreground">
      {box ? (
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
          {board.items.map((it) => <ItemView key={it.id} item={it} byId={byId} editing={false} onText={noop} onGrow={noop} />)}
        </div>
      ) : (
        <div className="grid size-full place-items-center text-tertiary-foreground"><Icon name="plus" size={28} sw={1.6} /></div>
      )}
    </div>
  );
}

export function BoardGallery({ compact }: { compact: boolean }) {
  const f = useFreeform();
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const boards = filter === 'favorites' ? f.boards.filter((b) => b.favorite) : f.boards;
  return (
    <div data-slot="freeform-gallery" className="absolute inset-0 flex animate-bl-fade-in flex-col bg-muted">
      <header className="flex h-toolbar shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Segmented
          aria-label="Show"
          value={filter}
          onChange={(v) => setFilter(v as 'all' | 'favorites')}
          options={[{ id: 'all', label: 'All Boards' }, { id: 'favorites', label: 'Favorites' }]}
        />
        <span className="flex-1" />
        <PlainButton onPress={() => f.newBoard()} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-primary px-3 text-detail font-semibold text-primary-foreground">
          <Icon name="plus" size={18} sw={2.2} />
          {compact ? null : 'New Board'}
        </PlainButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <h1 className="m-0 mb-4 text-[28px] leading-tight font-bold tracking-tight">{filter === 'favorites' ? 'Favorites' : 'Boards'}</h1>
        {boards.length ? (
          <ul className="m-0 grid list-none gap-5 p-0" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 150 : 210}px, 1fr))` }}>
            {boards.map((b) => (
              <li key={b.id} className="group/card relative flex flex-col gap-2">
                <PlainButton
                  aria-label={`Open ${b.title}`}
                  onPress={() => f.open(b.id)}
                  className="block cursor-pointer overflow-hidden rounded-card border border-border bg-background p-0 text-left shadow-[0_8px_20px_-12px] shadow-black/30 transition-transform duration-spring-snappy ease-spring-snappy hover:scale-[1.02] active:scale-[.98]"
                >
                  <BoardThumb board={b} />
                </PlainButton>
                <div className="flex min-w-0 items-start gap-1 px-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-detail font-semibold">{b.title}</div>
                    <div className="truncate text-footnote text-muted-foreground">{b.edited}</div>
                  </div>
                  {b.favorite ? <Icon name="star-fill" size={15} className="mt-0.5 shrink-0 text-warning" /> : null}
                </div>
                <div className={cn('absolute top-2 right-2 opacity-0 transition-opacity group-focus-within/card:opacity-100 group-hover/card:opacity-100')}>
                  <DropdownMenu>
                    <PlainButton aria-label={`${b.title} options`} className="grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-card/90 p-0 text-foreground shadow-hairline backdrop-blur-md">
                      <Icon name="ellipsis" size={18} sw={2} />
                    </PlainButton>
                    <DropdownMenuContent
                      aria-label={b.title}
                      placement="bottom end"
                      onAction={(k) => {
                        if (k === 'favorite') f.toggleFavorite(b.id);
                        else if (k === 'duplicate') f.duplicateBoard(b.id);
                        else if (k === 'delete') f.deleteBoard(b.id);
                      }}
                    >
                      <DropdownMenuItem id="favorite" className="min-h-10 py-2">{b.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</DropdownMenuItem>
                      <DropdownMenuItem id="duplicate" className="min-h-10 py-2">Duplicate</DropdownMenuItem>
                      <DropdownMenuItem id="delete" variant="destructive" className="min-h-10 py-2">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 py-16 text-center text-detail text-muted-foreground">No favorites yet — open a board’s menu and add one.</p>
        )}
      </div>
    </div>
  );
}
