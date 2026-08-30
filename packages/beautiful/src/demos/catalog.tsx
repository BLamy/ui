/* Beautiful UI — full catalog demo page: every primitive composed on a scrollable dark page.
   Consumed by the Pages/Beautiful UI story and the beautiful app. */
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  BChip,
  BEASE,
  BFONT,
  BIcon,
  BMONO,
  C,
  Kbd,
  P,
  beautifulDarkVars,
  card,
  mut,
  mut3,
  vib,
} from '../lib/base';
import { LoadingState, type LoadingStateVariant } from '../lib/loading-state';
import { Thinking } from '../lib/thinking';
import { StreamingText } from '../lib/streaming-text';
import { ApprovalCard } from '../lib/approval-card';
import { ToolChips } from '../lib/tool-chips';
import { TaskRows } from '../lib/task-rows';
import { RecommendationCard } from '../lib/recommendation-card';
import { ContextCards } from '../lib/context-cards';
import { DiffTable } from '../lib/diff-table';
import { RecordsTable } from '../lib/records-table';
import { FilterTable } from '../lib/filter-table';
import { SidebarProvider, SidebarInset, SidebarNav, SidebarTrigger, type SidebarVariant } from '../lib/sidebar';
import { SearchPalette } from '../lib/search-palette';
import { InsightCards } from '../lib/insight-cards';
import { CodeBlockStream } from '../lib/code-block-stream';
import { FineTuneCard } from '../lib/fine-tune-card';
import { SelectionActions } from '../lib/selection-actions';
import { Skeleton } from '../lib/skeleton';
import { Popover, Dropdown, Cite } from '../lib/popover';
import { ToastProvider, useToast } from '../lib/toast';
import { PlanReview } from '../lib/plan-review';
import { MemoryPills } from '../lib/memory-pills';
import { AgentBoard } from '../lib/agent-board';
import { CommandMenu } from '../lib/command-menu';
import { DatePicker } from '../lib/date-picker';
import { Combobox } from '../lib/combobox';
import { ModelPicker, type PickerModel } from '../lib/model-picker';

/* — demo data from the prototype docs registry — */
export const THINKING_DEMO = {
  steps: [
    ['Parse the restock request', true],
    ['Pull supplier lead times', true],
    ['Score stockout risk per SKU', true],
    ['Draft the reorder plan', false],
  ] as Array<[string, boolean]>,
  reasoning:
    'Waffle cones deplete fastest on weekends — 7-day lead time from cone_king means the order has to go out by Tuesday. Cross-checking against the Q4 velocity table before committing.',
  search: [
    ['scoopdata.io', 'seasonal cone demand curves'],
    ['trends.google.com', 'waffle cone interest, 90d'],
    ['marketbasket.io', 'wholesale cone pricing'],
  ] as Array<[string, string]>,
  coding: 'const risk = skus.map(s =>\n  s.velocity * lead(s.supplier) / s.stock)\nreturn risk.filter(r => r > 0.7)',
};

export const MODEL_PICKER_MODELS_DEMO: PickerModel[] = [
  { id: 'pickle', name: 'Big Pickle', provider: 'opencode', source: 'OpenCode · opencode' },
  { id: 'dr-max', name: 'Deep Research Max Preview', provider: 'google', source: 'OpenCode · google' },
  { id: 'dr-prev', name: 'Deep Research Preview', provider: 'google', source: 'OpenCode · google' },
  { id: 'ds-flash', name: 'DeepSeek V4 Flash Free', provider: 'deepseek', source: 'OpenCode · opencode' },
  { id: 'gem-cu', name: 'Gemini 2.5 Computer Use Preview', provider: 'google', source: 'OpenCode · google' },
  { id: 'sonnet', name: 'Claude Sonnet 4.5', provider: 'anthropic', source: 'OpenCode · anthropic' },
  { id: 'opus', name: 'Claude Opus 4.7', provider: 'anthropic', source: 'OpenCode · anthropic' },
  { id: 'g5', name: 'gpt-5.6-sol', provider: 'openai', source: 'OpenCode · openai' },
];

export interface DemoBtnProps {
  label: ReactNode;
  onPress?: () => void;
  style?: CSSProperties;
}
export const DemoBtn = ({ label, onPress, style }: DemoBtnProps) => (
  <button
    onClick={() => {
      vib([8]);
      onPress && onPress();
    }}
    style={{
      border: 0,
      borderRadius: 10,
      background: C.blue,
      color: '#fff',
      fontFamily: BFONT,
      fontWeight: 600,
      fontSize: 13,
      padding: '8px 15px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {label}
  </button>
);

function Section({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.5px',
          textTransform: 'uppercase',
          color: mut3,
          fontFamily: BFONT,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ThinkingDemo() {
  return (
    <div style={{ maxWidth: 520 }}>
      <Thinking defaultOpen>
        <Thinking.Trigger>Thinking</Thinking.Trigger>
        <Thinking.Content>
          <Thinking.Tabs>
            <Thinking.Tab id="steps">Steps</Thinking.Tab>
            <Thinking.Tab id="reasoning">Reasoning</Thinking.Tab>
            <Thinking.Tab id="search">Search</Thinking.Tab>
            <Thinking.Tab id="coding">Coding</Thinking.Tab>
          </Thinking.Tabs>
          <Thinking.Panel id="steps">
            {THINKING_DEMO.steps.map(([s, done], i) => (
              <Thinking.Step key={i} done={done}>
                {s}
              </Thinking.Step>
            ))}
          </Thinking.Panel>
          <Thinking.Panel id="reasoning">
            <p style={{ margin: 0 }}>{THINKING_DEMO.reasoning}</p>
          </Thinking.Panel>
          <Thinking.Panel id="search">
            {THINKING_DEMO.search.map(([site, q], i) => (
              <Thinking.Search key={i} site={site}>
                {q}
              </Thinking.Search>
            ))}
          </Thinking.Panel>
          <Thinking.Panel id="coding">
            <Thinking.Code>{THINKING_DEMO.coding}</Thinking.Code>
          </Thinking.Panel>
        </Thinking.Content>
      </Thinking>
    </div>
  );
}

export function SidebarDemo() {
  const [v, setV] = useState<SidebarVariant>('docked');
  const [narrow, setNarrow] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(['docked', 'rail', 'float', 'overlay'] as SidebarVariant[]).map((o) => (
          <BChip key={o} active={v === o} onPress={() => setV(o)}>
            {o}
          </BChip>
        ))}
        <BChip active={narrow} onPress={() => setNarrow((n) => !n)}>
          narrow container
        </BChip>
      </div>
      <div
        style={{
          width: narrow ? 380 : '100%',
          maxWidth: 640,
          height: 330,
          border: '1px solid var(--wb-sep)',
          borderRadius: 14,
          overflow: 'hidden',
          transition: 'width .35s ' + BEASE,
        }}
      >
        <SidebarProvider key={String(v) + narrow} defaultOpen={v !== 'overlay'} breakpoint={430}>
          <SidebarNav variant={v} />
          <SidebarInset>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--wb-sep)' }}
            >
              <SidebarTrigger />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)', fontFamily: BFONT }}>Home</span>
            </div>
            <div style={{ padding: 16, fontSize: 12.5, color: mut, lineHeight: 1.6, fontFamily: BFONT }}>
              One API, four behaviors — the trigger toggles whichever variant is mounted, and every variant becomes a hamburger
              overlay when the container is narrower than the breakpoint. Try “narrow container”.
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}

function ToastDemoPanel() {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 26 }}>
      <DemoBtn label="Info" onPress={() => toast.push({ tone: 'info', title: 'Agent resumed', detail: 'Picking up the reorder plan.' })} />
      <DemoBtn
        label="Success"
        onPress={() => toast.push({ tone: 'success', title: 'Order placed', detail: '48 cases from cone_king.' })}
        style={{ background: C.green }}
      />
      <DemoBtn
        label="Error"
        onPress={() => toast.push({ tone: 'error', title: 'Supplier API failed', detail: 'Retrying in 30s.' })}
        style={{ background: C.red }}
      />
    </div>
  );
}
export function ToastDemo() {
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
      <div style={{ height: 260, border: '1px solid var(--wb-sep)', borderRadius: 12, overflow: 'hidden' }}>
        <ToastProvider>
          <ToastDemoPanel />
        </ToastProvider>
      </div>
      <div style={{ fontSize: 11.5, color: mut3, textAlign: 'center', fontFamily: BFONT }}>
        Fire a few — they stack sonner-style; hover the stack to fan it out.
      </div>
    </div>
  );
}

export function PlanReviewDemo() {
  const [steps, setSteps] = useState([
    { id: 1, title: 'Pull POS exports', detail: '3 files · read-only' },
    { id: 2, title: 'Score stockout risk', detail: '7 SKUs' },
    { id: 3, title: 'Draft reorder emails', detail: '2 suppliers · held for review' },
    { id: 4, title: 'Place cone order', detail: 'writes to supplier API' },
  ]);
  const [ok, setOk] = useState(false);
  const move = (i: number, d: number) =>
    setSteps((x) => {
      const y = [...x];
      const [s] = y.splice(i, 1);
      y.splice(i + d, 0, s);
      return y;
    });
  return (
    <div style={{ maxWidth: 480 }}>
      <PlanReview approved={ok} onApprove={() => setOk(true)} onReject={() => setOk(false)}>
        {steps.map((s, i) => (
          <PlanReview.Step
            key={s.id}
            n={i + 1}
            detail={s.detail}
            onUp={i > 0 ? () => move(i, -1) : null}
            onDown={i < steps.length - 1 ? () => move(i, 1) : null}
            onRemove={steps.length > 1 ? () => setSteps((x) => x.filter((y) => y.id !== s.id)) : null}
          >
            {s.title}
          </PlanReview.Step>
        ))}
      </PlanReview>
      {ok && (
        <button
          onClick={() => setOk(false)}
          style={{ border: 0, background: 'none', color: C.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: BFONT, marginTop: 10 }}
        >
          Reset demo
        </button>
      )}
    </div>
  );
}

export function MemoryPillsDemo() {
  const ALL = [
    { id: 1, icon: 'user', text: 'Prefers metric units' },
    { id: 2, icon: 'cal', text: 'Reorders run Tuesdays' },
    { id: 3, icon: 'box', text: 'cone_king is primary supplier' },
    { id: 4, icon: 'bolt', text: 'Q4 goal: retire 2 flavors' },
  ];
  const [pills, setPills] = useState(ALL);
  return (
    <div style={{ maxWidth: 460 }}>
      <MemoryPills>
        {pills.map((p) => (
          <MemoryPills.Pill key={p.id} icon={p.icon} onDismiss={() => setPills((x) => x.filter((y) => y.id !== p.id))}>
            {p.text}
          </MemoryPills.Pill>
        ))}
      </MemoryPills>
      {pills.length < ALL.length && (
        <button
          onClick={() => setPills(ALL)}
          style={{
            border: 0,
            background: 'none',
            color: C.blue,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: BFONT,
            marginTop: 12,
            padding: 0,
          }}
        >
          Restore all
        </button>
      )}
    </div>
  );
}

export function AgentBoardDemo() {
  const [p, setP] = useState(0.32);
  useEffect(() => {
    const i = setInterval(() => setP((x) => (x >= 1 ? 0.05 : x + 0.04)), 500);
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{ maxWidth: 500 }}>
      <AgentBoard>
        <AgentBoard.Agent name="Researcher" task="Scanning supplier catalogs" state="running" progress={Math.min(p, 1)} />
        <AgentBoard.Agent name="Analyst" task="Scoring stockout risk" state="running" />
        <AgentBoard.Agent name="Writer" task="Drafted 2 supplier emails" state="done" />
        <AgentBoard.Agent name="Checker" task="Cold-chain cert lookup failed" state="failed" />
      </AgentBoard>
    </div>
  );
}

export function CommandMenuDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', height: 300, border: '1px solid var(--wb-sep)', borderRadius: 12, overflow: 'hidden', maxWidth: 640 }}>
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <button
          className="bui-hl"
          onClick={() => {
            setOpen(true);
            vib([6]);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            ...card({ padding: '8px 14px', borderRadius: 10 }),
            color: mut,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: BFONT,
            whiteSpace: 'nowrap',
          }}
        >
          <BIcon d={P['search']} size={14} />
          Search commands
          <Kbd>⌘K</Kbd>
        </button>
      </div>
      <CommandMenu open={open} onClose={() => setOpen(false)}>
        <CommandMenu.Input />
        <CommandMenu.List>
          <CommandMenu.Group title="Agent">
            <CommandMenu.Item icon="bolt" kbd="⌘R" keywords="forecast demand">
              Run demand forecast
            </CommandMenu.Item>
            <CommandMenu.Item icon="doc" keywords="email supplier draft">
              Draft supplier email
            </CommandMenu.Item>
            <CommandMenu.Item icon="spark" keywords="rebalance flavors">
              Rebalance flavors
            </CommandMenu.Item>
          </CommandMenu.Group>
          <CommandMenu.Group title="Navigate">
            <CommandMenu.Item icon="home" kbd="G H" keywords="go home">
              Go home
            </CommandMenu.Item>
            <CommandMenu.Item icon="inbox" kbd="G I" keywords="go inbox">
              Go to inbox
            </CommandMenu.Item>
          </CommandMenu.Group>
        </CommandMenu.List>
      </CommandMenu>
    </div>
  );
}

export function PopoverDropdownDemo() {
  const btn = (label: string) => (
    <button
      className="bui-hl"
      style={{
        ...card({ padding: '7px 14px', borderRadius: 9 }),
        color: 'var(--wb-label)',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: BFONT,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 210 }}>
      <Popover>
        <Popover.Trigger>{btn('Supplier details')}</Popover.Trigger>
        <Popover.Content>
          <b style={{ color: 'var(--wb-label)' }}>cone_king</b> — 7-day lead time, cold-chain certified. Last order 12 days ago,
          48 cases.
        </Popover.Content>
      </Popover>
      <Dropdown>
        <Dropdown.Trigger>{btn('Actions ▾')}</Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item icon="pen" kbd="⌘E">
            Edit record
          </Dropdown.Item>
          <Dropdown.Item icon="copy" kbd="⌘D">
            Duplicate
          </Dropdown.Item>
          <Dropdown.Item icon="doc">Export CSV</Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item icon="trash" danger>
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

export function CiteDemo() {
  return (
    <div style={{ maxWidth: 460, fontSize: 13.5, lineHeight: 1.7, color: 'var(--wb-label)', fontFamily: BFONT }}>
      <p style={{ margin: 0 }}>
        Pistachio is up 18% quarter over quarter
        <Cite n={1}>
          <Cite.Quote>Q4 velocity table: pistachio +18%, vanilla +6%, rocky road −11%.</Cite.Quote>
          <Cite.Source kind="CSV">Sales Velocity Export.csv</Cite.Source>
        </Cite>
        , with the sharpest lift on weekend afternoons
        <Cite n={2}>
          <Cite.Quote>Weekend scoop counts run 2.3× weekday baseline in summer.</Cite.Quote>
          <Cite.Source kind="PDF">Seasonal Demand Report.pdf</Cite.Source>
        </Cite>
        . Rocky Road sits below the retirement line.
      </p>
      <div style={{ fontSize: 11.5, color: mut3, marginTop: 14 }}>Press a citation number ↑</div>
    </div>
  );
}

export function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  return (
    <div style={{ maxWidth: 440, display: 'grid', gap: 12, justifyItems: 'center' }}>
      <div style={{ ...card({ padding: 16 }), width: '100%', boxSizing: 'border-box' }}>
        <Skeleton loading={loading}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              A
            </span>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.6, color: mut, fontFamily: BFONT }}>
              <div style={{ fontWeight: 650, color: 'var(--wb-label)', fontSize: 13 }}>Aurora Scoops</div>
              <div>Reykjavík gelato wholesaler — very strong connection, last interaction 9 days ago. Primary seasonal supplier.</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
                {['Gelato', 'Seasonal', 'B2B'].map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: mut,
                      background: 'var(--wb-fill)',
                      borderRadius: 5,
                      padding: '1.5px 8px',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Skeleton>
      </div>
      <BChip onPress={() => setLoading((l) => !l)} active={loading}>
        {loading ? 'loading — skeleton auto-generated' : 'resolved — press to reload'}
      </BChip>
    </div>
  );
}

export function LoadingStateDemo() {
  const [v, setV] = useState<LoadingStateVariant>('grid');
  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
      <LoadingState variant={v} />
      <div style={{ display: 'flex', gap: 6 }}>
        {(['grid', 'dots', 'orbit'] as LoadingStateVariant[]).map((o) => (
          <BChip key={o} active={v === o} onPress={() => setV(o)}>
            {o}
          </BChip>
        ))}
      </div>
    </div>
  );
}

export function DatePickerDemo() {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
      <DatePicker value={date} onChange={setDate} />
      <div style={{ fontFamily: BMONO, fontSize: 11.5, color: date ? C.blue : mut3 }}>
        {date ? date.toDateString() : 'pick a date'}
      </div>
    </div>
  );
}

export function ComboboxDemo() {
  const [v, setV] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'start', minHeight: 220, alignContent: 'start', paddingTop: 8 }}>
      <Combobox
        value={v}
        onChange={setV}
        placeholder="Pick a supplier…"
        options={['Aurora Scoops', 'Kumo Creamery', 'Maple Orbit', 'Coral Coast Sorbet', 'Ember Cone Company', 'Blue Fig Gelato']}
      />
      <div style={{ fontFamily: BMONO, fontSize: 11.5, color: v ? C.blue : mut3 }}>{v || 'nothing selected'}</div>
      <div style={{ fontSize: 11.5, color: mut3, fontFamily: BFONT }}>Arrow keys + Enter work too.</div>
    </div>
  );
}

export function ModelPickerDemo() {
  const [model, setModel] = useState('g5');
  return (
    <div style={{ minHeight: 360, display: 'grid', justifyContent: 'start', alignContent: 'start', gap: 10, paddingTop: 4 }}>
      <ModelPicker models={MODEL_PICKER_MODELS_DEMO} value={model} onChange={setModel} favorites={['sonnet', 'g5']} />
      <div style={{ fontSize: 11.5, color: mut3, fontFamily: BFONT }}>
        Filter by provider on the rail · ⌘ star favorites · ⌘1–⌘9 quick-select
      </div>
    </div>
  );
}

export function KbdDemo() {
  const rows: Array<[string, string[]]> = [
    ['Open command menu', ['⌘', 'K']],
    ['New thread', ['⌘', 'N']],
    ['Approve plan', ['⌘', '⏎']],
    ['Toggle sidebar', ['⌘', 'B']],
    ['Dismiss', ['esc']],
  ];
  return (
    <div style={{ maxWidth: 340, ...card({ padding: '6px 14px' }) }}>
      {rows.map(([label, keys], i) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: i < rows.length - 1 ? '1px solid var(--wb-sep)' : 'none',
          }}
        >
          <span style={{ fontSize: 12.5, color: 'var(--wb-label)', flex: 1 }}>{label}</span>
          <span style={{ display: 'flex', gap: 4 }}>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The full Beautiful UI catalog — a scrollable dark page composing every primitive. */
export function BeautifulCatalog({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <div
      data-slot="beautiful-catalog"
      className={className}
      style={{
        ...beautifulDarkVars,
        background: 'var(--wb-bg)',
        color: 'var(--wb-label)',
        minHeight: '100%',
        fontFamily: BFONT,
        padding: '28px 24px 64px',
        display: 'grid',
        gap: 34,
        boxSizing: 'border-box',
        maxWidth: 760,
        margin: '0 auto',
        ...style,
      }}
    >
      <header>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Beautiful UI</div>
        <div style={{ fontSize: 12.5, color: mut, marginTop: 4 }}>
          AI-native interface primitives in the TouchKit Workbench dark language.
        </div>
      </header>
      <Section title="LoadingState">
        <LoadingStateDemo />
      </Section>
      <Section title="Thinking">
        <ThinkingDemo />
      </Section>
      <Section title="StreamingText">
        <StreamingText />
      </Section>
      <Section title="ApprovalCard">
        <ApprovalCard />
      </Section>
      <Section title="ToolChips">
        <ToolChips />
      </Section>
      <Section title="TaskRows">
        <TaskRows />
      </Section>
      <Section title="RecommendationCard">
        <RecommendationCard />
      </Section>
      <Section title="ContextCards">
        <ContextCards />
      </Section>
      <Section title="DiffTable">
        <DiffTable />
      </Section>
      <Section title="RecordsTable">
        <RecordsTable />
      </Section>
      <Section title="FilterTable">
        <FilterTable />
      </Section>
      <Section title="Sidebar system">
        <SidebarDemo />
      </Section>
      <Section title="SearchPalette">
        <SearchPalette />
      </Section>
      <Section title="InsightCards">
        <InsightCards />
      </Section>
      <Section title="CodeBlockStream">
        <CodeBlockStream />
      </Section>
      <Section title="FineTuneCard">
        <FineTuneCard />
      </Section>
      <Section title="SelectionActions">
        <SelectionActions />
      </Section>
      <Section title="Toast">
        <ToastDemo />
      </Section>
      <Section title="Cite">
        <CiteDemo />
      </Section>
      <Section title="PlanReview">
        <PlanReviewDemo />
      </Section>
      <Section title="MemoryPills">
        <MemoryPillsDemo />
      </Section>
      <Section title="AgentBoard">
        <AgentBoardDemo />
      </Section>
      <Section title="CommandMenu">
        <CommandMenuDemo />
      </Section>
      <Section title="Popover · Dropdown">
        <PopoverDropdownDemo />
      </Section>
      <Section title="Skeleton">
        <SkeletonDemo />
      </Section>
      <Section title="DatePicker">
        <DatePickerDemo />
      </Section>
      <Section title="Combobox">
        <ComboboxDemo />
      </Section>
      <Section title="ModelPicker">
        <ModelPickerDemo />
      </Section>
      <Section title="Kbd">
        <KbdDemo />
      </Section>
    </div>
  );
}
