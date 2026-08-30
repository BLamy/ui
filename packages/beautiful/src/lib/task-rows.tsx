/* 06 — TaskRows: live agent task status, capsule / list layouts */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

export type TaskState = 'done' | 'run' | 'wait';
export interface TaskRow {
  n: number;
  title: ReactNode;
  meta: ReactNode;
  state: TaskState;
  subs: Array<[ReactNode, ReactNode, TaskState]>;
}
export const TASK_ROWS_DEMO: TaskRow[] = [
  {
    n: 1,
    title: 'Verified vendor records',
    meta: '12 suppliers',
    state: 'done',
    subs: [
      ['Matched tax and contact IDs', '12/12', 'done'],
      ['Flagged stale records', '0', 'done'],
    ],
  },
  {
    n: 2,
    title: 'Build reorder task list',
    meta: '7 SKUs',
    state: 'run',
    subs: [
      ['Reading POS export', '3 files', 'done'],
      ['Scoring stockout risk', '68%', 'run'],
    ],
  },
  {
    n: 3,
    title: 'Draft supplier emails',
    meta: '2 messages',
    state: 'wait',
    subs: [
      ['Cone supplier follow-up', 'draft', 'wait'],
      ['Pistachio reorder note', 'draft', 'wait'],
    ],
  },
];

export interface StateDotProps {
  s: TaskState;
}
export function StateDot({ s }: StateDotProps) {
  if (s === 'done')
    return (
      <span data-slot="state-dot" style={{ color: C.green, display: 'grid' }}>
        <BIcon d={P['check']} size={13} sw={2.6} />
      </span>
    );
  if (s === 'run')
    return (
      <span
        data-slot="state-dot"
        style={{
          width: 11,
          height: 11,
          border: '2px solid var(--wb-fill2)',
          borderTopColor: C.blue,
          borderRadius: '50%',
          animation: 'bui-spin .8s linear infinite',
        }}
      />
    );
  return (
    <span
      data-slot="state-dot"
      style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid var(--wb-fill2)' }}
    />
  );
}

export type TaskRowsMode = 'capsules' | 'list';
export interface TaskRowsProps {
  tasks?: TaskRow[];
  defaultMode?: TaskRowsMode;
  style?: CSSProperties;
  className?: string;
}
export function TaskRows({ tasks = TASK_ROWS_DEMO, defaultMode = 'capsules', style, className }: TaskRowsProps) {
  const [mode, setMode] = useState<TaskRowsMode>(defaultMode);
  return (
    <div data-slot="task-rows" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {(
          [
            ['capsules', 'Capsules'],
            ['list', 'List'],
          ] as Array<[TaskRowsMode, string]>
        ).map(([id, l]) => (
          <button
            key={id}
            className="bui-hl"
            onClick={() => {
              setMode(id);
              vib([4]);
            }}
            style={{
              border: 0,
              borderRadius: 7,
              padding: '4px 11px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BFONT,
              background: mode === id ? 'var(--wb-fill2)' : 'none',
              color: mode === id ? 'var(--wb-label)' : mut,
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {tasks.map((t) =>
          mode === 'capsules' ? (
            <div key={t.n} style={card({ padding: '11px 14px' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <StateDot s={t.state} />
                <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--wb-label)', flex: 1 }}>{t.title}</span>
                <span style={{ fontSize: 11.5, color: mut3 }}>{t.meta}</span>
                {t.state === 'done' && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.green,
                      background: 'rgba(50,215,75,.12)',
                      borderRadius: 6,
                      padding: '2px 7px',
                    }}
                  >
                    Completed
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 4, paddingLeft: 22 }}>
                {t.subs.map(([s, m, st], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: mut }}>
                    <StateDot s={st} />
                    <span style={{ flex: 1 }}>{s}</span>
                    <span style={{ fontFamily: BMONO, fontSize: 11, color: mut3 }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              key={t.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderBottom: '1px solid var(--wb-sep)',
              }}
            >
              <span style={{ fontFamily: BMONO, fontSize: 11, color: mut3, width: 14 }}>{t.n}</span>
              <StateDot s={t.state} />
              <span style={{ fontSize: 13, color: 'var(--wb-label)', flex: 1 }}>{t.title}</span>
              <span style={{ fontSize: 11.5, color: mut3 }}>{t.meta}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
