import * as React from 'react';
import { useRef, useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  GridList,
  GridListItem,
  Input,
  Menu,
  MenuItem,
  SearchField,
  SubmenuTrigger,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Key,
} from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import { WbPopover } from '@/components/ui/composer/composer-popover';
import { ComposerButton, ComposerPillLabel } from '@/components/ui/composer/composer';
import { PlainButton as Button } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { direction, springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { ModelOption, ModelProvider } from './models';

/* ══ ModelPicker — a searchable, provider-railed model menu (T3 Code style) ══
   Trigger pill → popover: search field; a vertical provider rail (favorites, then providers) as react-aria
   Tabs; the provider's models as a react-aria GridList (arrow keys, typeahead, a favorite star per row);
   "Legacy models" as a react-aria SubmenuTrigger. ⌘1…⌘9 pick while open. */

const FAVORITES = '__favorites';

/** A favorited model's star: a fixed gold. */
const FAVORITE_INK = 'text-[#FFB020]';

export interface ModelPickerProps {
  models: ModelOption[];
  providers: ModelProvider[];
  /** Selected model id. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Favorite model ids (starred). */
  favorites?: string[];
  defaultFavorites?: string[];
  onFavoritesChange?: (ids: string[]) => void;
  /** Controlled popover state. */
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger icon: the selected model's provider glyph (default), or any node. */
  icon?: 'provider' | React.ReactNode;
  /** Color the trigger with the accent (default true). */
  tint?: boolean;
  placement?: React.ComponentProps<typeof WbPopover>['placement'];
  className?: string;
  popoverClassName?: string;
}

function useMaybeControlled<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState(initial);
  return [
    value !== undefined ? value : inner,
    (v: T) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
  ];
}

export const modelRowVariants = cva(
  'group/row mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-foreground outline-none data-hovered:bg-secondary data-focused:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-primary/50 data-[current]:bg-secondary-strong',
);

const railTab =
  'relative grid size-8 cursor-pointer place-items-center rounded-[9px] text-[16px] text-muted-foreground outline-none [transition:color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-hovered:bg-secondary data-hovered:text-foreground data-selected:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-primary/50';

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

const listSlide = {
  enter: (dir: number) => ({ y: dir * 28, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -28, opacity: 0, transition: { ...springs.snappy, opacity: { duration: 0.12 } } }),
};

export function ModelPicker({
  models,
  providers,
  value: valueProp,
  defaultValue,
  onChange,
  favorites: favoritesProp,
  defaultFavorites = [],
  onFavoritesChange,
  isOpen: isOpenProp,
  defaultOpen = false,
  onOpenChange,
  icon = 'provider',
  tint = true,
  placement = 'top start',
  className,
  popoverClassName,
}: ModelPickerProps) {
  const [value, setValue] = useMaybeControlled(valueProp, defaultValue ?? models.find((m) => !m.legacy)?.id ?? '', onChange);
  const [favorites, setFavorites] = useMaybeControlled(favoritesProp, defaultFavorites, onFavoritesChange);
  const [isOpen, setOpen] = useMaybeControlled(isOpenProp, defaultOpen, onOpenChange);
  const current = models.find((m) => m.id === value);
  const providerOf = (m?: ModelOption) => providers.find((p) => p.id === m?.provider);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>(() => current?.provider ?? providers[0]?.id ?? FAVORITES);
  const gridRef = useRef<HTMLDivElement>(null);
  const group = React.useId();
  // The list slides the way the rail moved: a provider lower in the rail brings its models up from below.
  const railOrder = [FAVORITES, ...providers.map((p) => p.id)];
  const [travel, setTravel] = useState(0);

  const choose = (id: string) => {
    setValue(id);
    setOpen(false);
  };
  const toggleFavorite = (id: string) => {
    setFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]);
  };

  const q = query.trim().toLowerCase();
  const matches = (m: ModelOption) =>
    !q || m.name.toLowerCase().includes(q) || (providerOf(m)?.name.toLowerCase().includes(q) ?? false);
  const listed = q
    ? models.filter(matches)
    : tab === FAVORITES
      ? models.filter((m) => favorites.includes(m.id))
      : models.filter((m) => m.provider === tab && !m.legacy);
  const legacy = models.filter((m) => m.legacy);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || !/^[1-9]$/.test(event.key)) return;
    const hit = models.find((m) => m.shortcut === Number(event.key));
    if (!hit) return;
    event.preventDefault();
    choose(hit.id);
  };

  const triggerIcon =
    icon === 'provider' ? <span className="grid size-[13.5px] place-items-center text-[13px]">{providerOf(current)?.icon}</span> : icon;

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setQuery('');
          setTab(current?.provider ?? providers[0]?.id ?? FAVORITES);
        }
        setOpen(open);
      }}
    >
      <ComposerButton data-slot="model-picker" variant="pill" tint={tint} aria-label={`Model: ${current?.name ?? 'none'}`} className={className}>
        <ComposerPillLabel icon={triggerIcon}>{current?.name ?? 'Choose model'}</ComposerPillLabel>
      </ComposerButton>
      <WbPopover placement={placement} className={cn('w-[370px] max-w-[calc(100vw-24px)] overflow-hidden p-0', popoverClassName)}>
        <Dialog data-slot="model-picker-content" aria-label="Choose a model" className="outline-none">
          {/* ⌘1…⌘9 anywhere in the picker (capture: react-aria's fields and lists stop keydown propagation). */}
          <div className="flex flex-col" onKeyDownCapture={onKeyDown}>
          <SearchField
            aria-label="Search models"
            value={query}
            onChange={setQuery}
            autoFocus
            data-slot="model-picker-search"
            className="relative flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 after:absolute after:inset-x-0 after:-bottom-px after:h-[1.5px] after:bg-transparent after:transition-colors after:content-[''] focus-within:after:bg-primary"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                gridRef.current?.querySelector<HTMLElement>('[role=row]')?.focus();
              }
            }}
          >
            <Icon name="magnifier" size={14} sw={2} className="text-tertiary-foreground" />
            <Input
              placeholder="Search models…"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 font-ios text-[13px] text-foreground outline-none placeholder:text-tertiary-foreground! [&::-webkit-search-cancel-button]:hidden"
            />
          </SearchField>
          <Tabs
            orientation="vertical"
            selectedKey={tab}
            onSelectionChange={(k) => {
              setTravel(direction(railOrder.indexOf(tab), railOrder.indexOf(String(k))));
              setTab(String(k));
              setQuery('');
            }}
            className="flex h-[292px] min-h-0"
          >
            <TabList aria-label="Providers" data-slot="model-picker-rail" className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
              <Tab id={FAVORITES} aria-label="Favorites" className={cn(railTab, 'isolate mb-1.5 after:absolute after:-bottom-[5px] after:h-px after:w-6 after:bg-border after:content-[""]')}>
                {({ isSelected }) => (
                  <>
                    <RailIndicator group={group} selected={isSelected} />
                    <Icon name="star-sharp" size={15} sw={2} />
                  </>
                )}
              </Tab>
              {providers.map((p) => (
                <Tab key={p.id} id={p.id} aria-label={p.name} className={cn(railTab, 'isolate')}>
                  {({ isSelected }) => (
                    <>
                      <RailIndicator group={group} selected={isSelected} />
                      {p.icon}
                    </>
                  )}
                </Tab>
              ))}
            </TabList>
            <TabPanel id={tab} className="wb-scroll relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-1.5 outline-none">
              {q ? <div className="px-4 pt-1 pb-1.5 text-[11px] font-semibold tracking-[.04em] text-tertiary-foreground uppercase">Results</div> : null}
              <AnimatePresence mode="popLayout" initial={false} custom={travel}>
              <motion.div
                key={q ? 'search' : tab}
                custom={travel}
                variants={listSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.smooth}
              >
              <GridList
                ref={gridRef}
                aria-label={q ? 'Matching models' : tab === FAVORITES ? 'Favorite models' : `${providers.find((p) => p.id === tab)?.name ?? ''} models`}
                data-slot="model-picker-list"
                items={listed}
                onAction={(key: Key) => choose(String(key))}
                className="flex flex-col gap-px outline-none"
                renderEmptyState={() => (
                  <div className="px-4 py-8 text-center text-[12.5px] text-tertiary-foreground">
                    {q ? 'No models match.' : tab === FAVORITES ? 'Star a model to keep it here.' : 'No models.'}
                  </div>
                )}
              >
                {(m) => {
                  const p = providerOf(m);
                  const fav = favorites.includes(m.id);
                  return (
                    <GridListItem
                      id={m.id}
                      textValue={m.name}
                      data-slot="model-picker-item"
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
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                          <span className="grid shrink-0 place-items-center text-[11px]">{p?.icon}</span>
                          <span className="truncate">{p?.name}</span>
                          {m.legacy ? <span className="text-tertiary-foreground">· legacy</span> : null}
                        </span>
                      </span>
                      {m.shortcut ? (
                        <kbd className="shrink-0 rounded-[5px] bg-secondary px-1.5 py-px font-ios text-[11px] leading-[16px] text-muted-foreground">⌘{m.shortcut}</kbd>
                      ) : null}
                      <Button
                        aria-label={fav ? `Unfavorite ${m.name}` : `Favorite ${m.name}`}
                        onPress={() => toggleFavorite(m.id)}
                        className={cn(
                          'grid size-6 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent p-0 outline-none data-hovered:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-primary/50',
                          fav ? FAVORITE_INK : 'text-tertiary-foreground opacity-0 group-data-focused/row:opacity-100 group-data-hovered/row:opacity-100 data-focus-visible:opacity-100',
                        )}
                      >
                        <Icon name="star-sharp" size={14} sw={2} className={fav ? '[&_path]:fill-current' : undefined} />
                      </Button>
                    </GridListItem>
                  );
                }}
              </GridList>
              </motion.div>
              </AnimatePresence>
            </TabPanel>
          </Tabs>
          {legacy.length ? (
            <Menu aria-label="More models" data-slot="model-picker-more" className="shrink-0 border-t border-border p-1.5 outline-none">
              <SubmenuTrigger>
                <MenuItem
                  textValue="Legacy models"
                  className="flex cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13px] text-foreground outline-none data-focused:bg-secondary data-open:bg-secondary"
                >
                  <Icon name="clock-dial" size={14} sw={2} className="text-muted-foreground" />
                  <span className="flex-1 font-medium">Legacy models</span>
                  <span className="text-[12px] text-tertiary-foreground">{legacy.length} models</span>
                  <Icon name="chevron-right-wide" size={12} sw={2.4} className="text-tertiary-foreground" />
                </MenuItem>
                <WbPopover offset={4} className="min-w-[220px] p-1">
                  <Menu aria-label="Legacy models" className="outline-none" onAction={(k) => choose(String(k))}>
                    {legacy.map((m) => (
                      <MenuItem
                        key={m.id}
                        id={m.id}
                        textValue={m.name}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-[7px] text-[13px] text-foreground outline-none data-focused:bg-secondary"
                      >
                        <span className="grid w-3.5 shrink-0 place-items-center text-[12px] text-muted-foreground">{providerOf(m)?.icon}</span>
                        <span className="flex-1 truncate">{m.name}</span>
                        {m.id === value ? <Icon name="checkmark" size={13} sw={2.6} className="text-primary" /> : null}
                      </MenuItem>
                    ))}
                  </Menu>
                </WbPopover>
              </SubmenuTrigger>
            </Menu>
          ) : null}
          </div>
        </Dialog>
      </WbPopover>
    </DialogTrigger>
  );
}
