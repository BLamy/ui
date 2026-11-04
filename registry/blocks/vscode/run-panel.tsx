'use client';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { SidebarHeader } from './explorer';
import type { VSCodeStore } from './store';

/** The project's scripts, as the runtime lists them. Each runs in a terminal of its own, until it's over or it's stopped. */
export function RunPanel({ store }: { store: VSCodeStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const { scripts, note } = store.scripts;
  return (
    <div data-slot="vscode-run" className="flex h-full min-h-0 flex-col">
      <SidebarHeader title="Run" />
      {scripts.length === 0 ? (
        <p className="m-0 px-4 text-footnote text-muted-foreground">{note ?? 'There are no scripts.'}</p>
      ) : (
        <ul className="m-0 min-h-0 flex-1 list-none overflow-auto bl-scroll p-0">
          {scripts.map(({ name, command }) => {
            const terminal = store.scriptTerminal(name);
            const running = terminal?.state === 'open' || terminal?.state === 'opening';
            return (
              <li key={name} className="flex items-center gap-1 py-1 ps-4 pe-1.5 hover:bg-secondary/60">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-footnote font-medium">{name}</div>
                  <div className="truncate font-mono text-caption2 text-muted-foreground">{command}</div>
                </div>
                {running ? (
                  <Button variant="quiet" size="icon-sm" aria-label={`Stop ${name}`} title={`Stop ${name}`} onPress={() => store.stopScript(name)}>
                    <Icon name="stop" size={15} className="text-destructive" />
                  </Button>
                ) : (
                  <Button variant="quiet" size="icon-sm" aria-label={`Run ${name}`} title={`Run ${name}`} onPress={() => store.runScript(name)}>
                    <Icon name="play" size={15} className="text-success" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
