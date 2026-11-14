import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { animateIn, type ChangeDetails } from '@ui-sdk/core';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@ui-sdk/react/command';
import type { PopoverOpenChangeReason } from '@ui-sdk/react/popover';
import { registerShortcut } from '@ui-sdk/react/shortcuts';
import { Toggle as SdkToggle, ToggleGroup } from '@ui-sdk/react/toggle';
import { cva } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { ComposerPill } from '@/components/ui/composer/composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@ui-sdk/react/button';
import { changeDetails } from '@/lib/change-details';
import { useControllableChange } from '@/lib/controllable-state';
import { Icon } from '@/lib/icon';
import { direction, springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { ModelOption, ModelProvider } from './models';

/* ══ ModelPicker — a searchable, provider-railed model menu (T3 Code style) ══
   Trigger pill → popover (UI SDK Popover): a Command (search field over the models: arrow keys, Enter, filtering);
   a vertical provider rail (favorites, then providers) as a single-select ToggleGroup that picks which models the
   list shows while the search is empty; a favorite star per row (Shift+Enter stars the highlighted model);
   "Legacy models" as a menu beside the footer row. ⌘1…⌘9 pick while open. */

const FAVORITES = '__favorites';

/** A favorited model's star: a fixed gold. */
const FAVORITE_INK = 'text-[#FFB020]';

/** Why the model changed: a row or legacy-menu pick (click, Enter), or its ⌘N shortcut. */
export type ModelPickerValueChangeReason = 'item-press' | 'shortcut';
/** Why the favorites changed: a row's star, or Shift+Enter on the highlighted row. */
export type ModelPickerFavoritesChangeReason = 'star-press' | 'shortcut';

type Side = React.ComponentProps<typeof PopoverContent>['side'];
type Align = React.ComponentProps<typeof PopoverContent>['align'];

export interface ModelPickerProps {
  models: ModelOption[];
  providers: ModelProvider[];
  /** Selected model id. */
  value?: string;
  defaultValue?: string;
  /** Runs before the model changes; `details.cancel()` keeps the current one (and the picker open). */
  onValueChange?: (id: string, details: ChangeDetails<ModelPickerValueChangeReason>) => void;
  /** Favorite model ids (starred). */
  favorites?: string[];
  defaultFavorites?: string[];
  onFavoritesChange?: (ids: string[], details: ChangeDetails<ModelPickerFavoritesChangeReason>) => void;
  /** Controlled popover state. */
  open?: boolean;
  defaultOpen?: boolean;
  /** The Popover's own change details (Escape, outside press, the trigger…); a pick closes it with `imperative`,
      a ⌘N pick with `shortcut`. `details.cancel()` keeps it as it is. */
  onOpenChange?: (open: boolean, details: ChangeDetails<PopoverOpenChangeReason>) => void;
  /** Trigger icon: the selected model's provider glyph (default), or any node. */
  icon?: 'provider' | React.ReactNode;
  /** Color the trigger with the accent (default true). */
  tint?: boolean;
  /** Where the popover opens against the pill. Default `top` / `start`. */
  side?: Side;
  align?: Align;
  className?: string;
  popoverClassName?: string;
}

export const modelRowVariants = cva(
  'group/row mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-ctl px-2.5 py-[7px] text-foreground outline-none hover:bg-secondary data-highlighted:bg-secondary data-[current]:bg-secondary-strong',
);

const railTab =
  'relative grid size-8 cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent p-0 text-callout text-muted-foreground outline-none [transition:color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] hover:bg-secondary hover:text-foreground data-pressed:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50';

/** The selected rail tab's fill and accent bar: one element that slides between tabs (a shared layout). */
function RailIndicator({ group, selected }: { group: string; selected: boolean }) {
  if (!selected) return null;
  return (
    <motion.span
      layoutId={`${group}-rail`}
      aria-hidden="true"
      data-slot="model-picker-rail-indicator"
      className="absolute inset-0 -z-1 rounded-[9px] bg-secondary"
      transition={springs.snappy}
    >
      <span className="absolute top-1/2 -left-[7px] h-4 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-primary" />
    </motion.span>
  );
}

/** The models of one rail stop rise in from the way the rail moved (UI SDK's `animateIn` on `data-starting-style`). */
function SlideIn({ travel, children }: { travel: number; children: React.ReactNode }) {
  return (
    <div
      ref={(el) => (el ? animateIn(el) : undefined)}
      className="flex flex-col gap-px transition-[translate,opacity] duration-spring-smooth ease-spring-smooth data-starting-style:translate-y-(--travel) data-starting-style:opacity-0 motion-reduce:transition-none"
      style={{ '--travel': `${travel * 28}px` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** "Legacy models": a row that opens the older models beside the picker. */
function LegacyMenu({ legacy, value, providerOf, onPick }: { legacy: ModelOption[]; value: string; providerOf: (m?: ModelOption) => ModelProvider | undefined; onPick: (id: string, event?: Event) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-[9px] border-0 bg-transparent px-2.5 py-2 text-left font-sans text-footnote text-foreground outline-none hover:bg-secondary focus-visible:bg-secondary data-open:bg-secondary">
        <Icon name="clock-dial" size={14} sw={2} className="text-muted-foreground" />
        <span className="flex-1 font-medium">Legacy models</span>
        <span className="text-caption text-tertiary-foreground">{legacy.length} models</span>
        <Icon name="chevron-right-wide" size={12} sw={2.4} className="text-tertiary-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent size="sm" side="right" align="end" sideOffset={4} palette="trigger" className="min-w-[220px]">
        <DropdownMenuRadioGroup value={value} onValueChange={(id, details) => id && onPick(id, details.event)}>
          {legacy.map((m) => (
            <DropdownMenuRadioItem key={m.id} value={m.id} label={m.name} closeOnSelect icon={<span className="text-caption text-muted-foreground">{providerOf(m)?.icon}</span>}>
              {m.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ModelPicker({
  models,
  providers,
  value: valueProp,
  defaultValue,
  onValueChange,
  favorites: favoritesProp,
  defaultFavorites = [],
  onFavoritesChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  icon = 'provider',
  tint = true,
  side = 'top',
  align = 'start',
  className,
  popoverClassName,
}: ModelPickerProps) {
  const [value, setValue] = useControllableChange(valueProp, defaultValue ?? models.find((m) => !m.legacy)?.id ?? '', onValueChange);
  const [favorites, setFavorites] = useControllableChange(favoritesProp, defaultFavorites, onFavoritesChange);
  const [openInner, setOpenInner] = useState(defaultOpen);
  const open = openProp ?? openInner;
  /** Tells the consumer first, with the Popover's details or a pick's own; moves only if they didn't cancel. */
  const changeOpen = (next: boolean, details: ChangeDetails<PopoverOpenChangeReason>) => {
    onOpenChange?.(next, details);
    if (details.canceled) return false;
    if (openProp === undefined) setOpenInner(next);
    return true;
  };
  const current = models.find((m) => m.id === value);
  const providerOf = (m?: ModelOption) => providers.find((p) => p.id === m?.provider);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>(() => current?.provider ?? providers[0]?.id ?? FAVORITES);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const group = React.useId();
  // The list slides the way the rail moved: a provider lower in the rail brings its models up from below.
  const railOrder = [FAVORITES, ...providers.map((p) => p.id)];
  const [travel, setTravel] = useState(0);

  /** A pick: the model changes (unless canceled), then the picker closes for the same reason. */
  const choose = (id: string, reason: ModelPickerValueChangeReason, event?: Event) => {
    const changed = id === value || setValue(id, { reason, event });
    if (changed) changeOpen(false, changeDetails({ reason: reason === 'shortcut' ? 'shortcut' : 'imperative', event }));
  };
  const toggleFavorite = (id: string, reason: ModelPickerFavoritesChangeReason, event?: Event) => {
    setFavorites((ids) => (ids.includes(id) ? ids.filter((f) => f !== id) : [...ids, id]), { reason, event });
  };

  const q = query.trim();
  const listed = q
    ? models
    : tab === FAVORITES
      ? models.filter((m) => favorites.includes(m.id))
      : models.filter((m) => m.provider === tab && !m.legacy);
  const legacy = models.filter((m) => m.legacy);

  // ⌘1…⌘9 pick while the picker is open: shortcuts of its popup layer (UI SDK's shared `shortcuts`).
  const pick = useRef(choose);
  pick.current = choose;
  useEffect(() => {
    if (!open) return;
    const off = models
      .filter((m) => m.shortcut)
      .map((m) => registerShortcut(
          `mod+${m.shortcut}`,
          (event) => {
            event.preventDefault();
            pick.current(m.id, 'shortcut', event);
          },
          { layer: () => searchRef.current },
        ));
    return () => off.forEach((unregister) => unregister());
  }, [open, models]);

  // Shift+Enter stars the highlighted model (Enter alone picks it).
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || !event.shiftKey || !highlighted) return;
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(highlighted, 'shortcut', event.nativeEvent);
  };

  const triggerIcon =
    icon === 'provider' ? <span className="grid size-[13.5px] place-items-center text-footnote">{providerOf(current)?.icon}</span> : icon;
  const listName = q ? 'Matching models' : tab === FAVORITES ? 'Favorite models' : `${providers.find((p) => p.id === tab)?.name ?? ''} models`;

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!changeOpen(next, details) || !next) return;
        setQuery('');
        setTab(current?.provider ?? providers[0]?.id ?? FAVORITES);
      }}
    >
      <PopoverTrigger
        render={<ComposerPill icon={triggerIcon} aria-label={`Model: ${current?.name ?? 'none'}`} className={cn(tint && 'text-primary', className)} />}
      >
        {current?.name ?? 'Choose model'}
      </PopoverTrigger>
      <PopoverContent
        variant="surface"
        palette="trigger"
        side={side}
        align={align}
        initialFocus={() => searchRef.current}
        className={cn('w-[370px] max-w-[calc(100cqw-24px)] overflow-hidden p-0', popoverClassName)}
      >
        {/* The popup's name (UI SDK points `aria-labelledby` at the title, over the trigger's "Model: …"). */}
        <PopoverTitle className="sr-only">Choose a model</PopoverTitle>
        {/* Shift+Enter anywhere in the picker, ahead of the field's and the list's own keys. */}
        <div className="flex flex-col" onKeyDownCapture={onKeyDown}>
          <Command
            query={query}
            onQueryChange={(next) => setQuery(next)}
            value={highlighted}
            onValueChange={(next) => setHighlighted(next)}
            onAction={(id, details) => choose(id, 'item-press', details.event)}
            filter="contains"
            className="flex flex-col"
          >
            <div
              data-slot="model-picker-search"
              className="relative flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 after:absolute after:inset-x-0 after:-bottom-px after:h-[1.5px] after:bg-transparent after:transition-colors after:content-[''] focus-within:after:bg-primary"
            >
              <Icon name="magnifier" size={14} sw={2} className="text-tertiary-foreground" />
              <CommandInput
                ref={searchRef}
                aria-label="Search models"
                placeholder="Search models…"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-footnote text-foreground outline-none placeholder:text-tertiary-foreground! [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <div className="flex h-[292px] min-h-0">
              <ToggleGroup
                aria-label="Providers"
                orientation="vertical"
                value={[tab]}
                deselectable={false}
                onValueChange={([next]) => {
                  if (!next) return;
                  setTravel(direction(railOrder.indexOf(tab), railOrder.indexOf(next)));
                  setTab(next);
                  setQuery('');
                }}
                className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2"
              >
                <SdkToggle
                  value={FAVORITES}
                  aria-label="Favorites"
                  className={cn(railTab, 'isolate mb-1.5 after:absolute after:-bottom-[5px] after:h-px after:w-6 after:bg-border after:content-[""]')}
                >
                  <RailIndicator group={group} selected={tab === FAVORITES} />
                  <Icon name="star-sharp" size={15} sw={2} />
                </SdkToggle>
                {providers.map((p) => (
                  <SdkToggle key={p.id} value={p.id} aria-label={p.name} className={cn(railTab, 'isolate')}>
                    <RailIndicator group={group} selected={tab === p.id} />
                    {p.icon}
                  </SdkToggle>
                ))}
              </ToggleGroup>
              <div className="wb-scroll relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-1.5">
                {q ? <div className="px-4 pt-1 pb-1.5 text-caption2 font-semibold tracking-[.04em] text-tertiary-foreground uppercase">Results</div> : null}
                <CommandEmpty className="px-4 py-8 text-center text-[12.5px] text-tertiary-foreground not-data-empty:hidden">
                  {q ? 'No models match.' : tab === FAVORITES ? 'Star a model to keep it here.' : 'No models.'}
                </CommandEmpty>
                <CommandList aria-label={listName} className="outline-none">
                  <SlideIn key={q ? 'search' : tab} travel={q ? 0 : travel}>
                    {listed.map((m) => {
                      const p = providerOf(m);
                      const fav = favorites.includes(m.id);
                      return (
                        <CommandItem
                          key={m.id}
                          value={m.id}
                          label={m.name}
                          keywords={p ? [p.name] : undefined}
                          aria-current={m.id === value || undefined}
                          data-current={m.id === value || undefined}
                          className={modelRowVariants()}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-[13.5px] font-semibold">{m.name}</span>
                              {m.badge ? (
                                <span className="shrink-0 rounded-[5px] border border-primary px-[5px] py-px text-[9.5px] leading-[12px] font-bold tracking-[.05em] text-primary">
                                  {m.badge}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
                              <span className="grid shrink-0 place-items-center text-caption2">{p?.icon}</span>
                              <span className="truncate">{p?.name}</span>
                              {m.legacy ? <span className="text-tertiary-foreground">· legacy</span> : null}
                            </span>
                          </span>
                          {m.shortcut ? (
                            <kbd className="shrink-0 rounded-[5px] bg-secondary px-1.5 py-px font-sans text-caption2 leading-[16px] text-muted-foreground">⌘{m.shortcut}</kbd>
                          ) : null}
                          {/* The star is the row's secondary action for the pointer; from the keyboard it is Shift+Enter
                              on the highlighted row, so it stays out of the option's accessible content. */}
                          <Button
                            tabIndex={-1}
                            aria-hidden
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              toggleFavorite(m.id, 'star-press', e.nativeEvent);
                            }}
                            className={cn(
                              'grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0 outline-none hover:bg-secondary-strong',
                              fav ? FAVORITE_INK : 'text-tertiary-foreground opacity-0 group-hover/row:opacity-100 group-data-highlighted/row:opacity-100',
                            )}
                          >
                            <Icon name="star-sharp" size={14} sw={2} className={fav ? '[&_path]:fill-current' : undefined} />
                          </Button>
                        </CommandItem>
                      );
                    })}
                  </SlideIn>
                </CommandList>
              </div>
            </div>
          </Command>
          {legacy.length ? (
            <div className="shrink-0 border-t border-border p-1.5">
              <LegacyMenu legacy={legacy} value={value} providerOf={providerOf} onPick={(id, event) => choose(id, 'item-press', event)} />
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
