import * as React from 'react';
import { useState } from 'react';
import { Button } from '../../lib/workbench/press';
import { cn } from '../../lib/workbench/util';
import { vib, tick } from '../../lib/workbench/haptics';
import { WIcon, IconBtn } from '../../lib/workbench/icons';

/* ══ Thread sidebar ══ */
export interface WorkbenchThread {
  id: string;
  title: string;
  age: string;
  settled?: boolean;
  msgs: WorkbenchMessage[];
}
export interface WorkbenchTrace {
  steps: string[];
  search?: [string, string][];
  code?: string;
}
export interface WorkbenchMessage {
  id: string;
  role: 'user' | 'assistant';
  md?: string;
  imgs?: string[];
  live?: boolean;
  meta?: string;
  trace?: WorkbenchTrace;
}

/* Sidebar row chrome shared by threads, "All projects", "Show more" and Settings. */
const rowBtn = 'wb-btn wb-hl flex cursor-pointer items-center gap-2 rounded-lg border-0 text-left';

export interface ThreadSidebarProps {
  threads: WorkbenchThread[];
  cur?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function ThreadSidebar({ threads, cur, onSelect, onNew, onClose, compact, className, style }: ThreadSidebarProps) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [openSec, setOpenSec] = useState(true);
  const list = threads.filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const active = list.filter((t) => !t.settled),
    settled = list.filter((t) => t.settled);
  const shownSettled = showAll ? settled : settled.slice(0, 7);
  const row = (t: WorkbenchThread) => (
    <Button
      key={t.id}
      data-slot="thread-row"
      className={cn(rowBtn, 'box-border w-full px-2 py-1.5 text-[13px] text-wb-label', cur === t.id ? 'bg-wb-fill2' : 'bg-transparent')}
      onPress={() => {
        tick();
        onSelect(t.id);
      }}
    >
      <WIcon name="msg" size={15} sw={1.8} className="text-wb-label3" />
      <span className="min-w-0 flex-1 truncate">{t.title}</span>
      <span className="shrink-0 text-[11.5px] text-wb-label3">{t.age}</span>
    </Button>
  );
  return (
    <div data-slot="thread-sidebar" className={cn('box-border flex h-full w-full flex-col bg-wb-side', className)} style={style}>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
          <WIcon name="spark" size={13} sw={2.2} className="text-white" />
        </span>
        <span className="text-[13.5px] font-bold tracking-[-.1px]">Workbench</span>
        {compact ? <IconBtn name="x" label="Close sidebar" onPress={onClose} className="ml-auto" /> : null}
      </div>
      <div className="flex gap-1.5 px-3 pb-1.5">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-wb-fill px-2 py-[5px]">
          <WIcon name="search" size={14} sw={2} className="text-wb-label3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search threads"
            className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] [font-family:inherit] text-wb-label outline-none"
          />
        </div>
        <IconBtn
          name="compose"
          label="New thread"
          onPress={() => {
            vib([8]);
            onNew();
          }}
          size={17}
        />
      </div>
      <Button className={cn(rowBtn, 'mx-2 bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-wb-label2')}>
        <WIcon name="folder" size={15} sw={1.8} />
        <span className="flex-1">All projects</span>
        <WIcon name="chevD" size={13} sw={2.2} />
        <WIcon name="folderP" size={15} sw={1.8} className="text-wb-label3" />
      </Button>
      <div className="wb-scroll min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
        {active.length ? (
          <React.Fragment>
            <div className="flex items-center gap-2 px-2 pt-2.5 pb-1">
              <span className="text-[11px] font-semibold tracking-[.4px] text-wb-label3">Active</span>
              <span className="h-px flex-1 bg-wb-sep" />
            </div>
            {active.map(row)}
          </React.Fragment>
        ) : null}
        <Button
          aria-expanded={openSec}
          className="wb-btn box-border flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 pt-2.5 pb-1"
          onPress={() => {
            setOpenSec((o) => !o);
            tick();
          }}
        >
          <span className="text-[11px] font-semibold tracking-[.4px] text-wb-label3">Settled</span>
          <span className="h-px flex-1 bg-wb-sep" />
          <WIcon name={openSec ? 'chevU' : 'chevD'} size={12} sw={2.2} className="text-wb-label3" />
        </Button>
        {openSec ? (
          <React.Fragment>
            {shownSettled.map(row)}
            {settled.length > shownSettled.length ? (
              <Button
                className={cn(rowBtn, 'w-full bg-transparent px-2 py-1.5 text-[12.5px] text-wb-label3')}
                onPress={() => {
                  setShowAll(true);
                  tick();
                }}
              >
                <WIcon name="plus" size={13} sw={2} />
                <span>Show {settled.length - shownSettled.length} more</span>
              </Button>
            ) : null}
          </React.Fragment>
        ) : null}
      </div>
      <div className="border-t border-wb-sep px-2.5 pt-2 pb-2.5">
        <div className="mb-1.5 flex items-center gap-2 rounded-[9px] bg-[rgba(10,132,255,.12)] px-2.5 py-[7px]">
          <WIcon name="dl" size={14} sw={2} className="text-wb-tint" />
          <span className="flex-1 text-[12.5px] font-semibold text-wb-tint">Update available</span>
          <WIcon name="x" size={13} sw={2} className="text-wb-label3" />
        </div>
        <Button className={cn(rowBtn, 'w-full bg-transparent px-2 py-[7px] text-[13px] text-wb-label2')}>
          <WIcon name="gear" size={16} sw={1.7} />
          <span>Settings</span>
        </Button>
      </div>
    </div>
  );
}
