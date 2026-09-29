import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ICON_CATEGORIES, ICON_KEYWORDS, ICON_NAMES, ICON_WEIGHTS, Icon, type IconCategory, type IconWeight } from './icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Icon> = {
  title: 'Atoms/Icon',
  component: Icon,
  decorators: [(Story, ctx) => <Pad w={(ctx.parameters['padW'] as number | undefined) ?? 420}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Icon>;

const mono = { fontFamily: 'ui-monospace,Menlo,monospace' };
const cell = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--foreground)', minWidth: 0 } as const;
const label = { ...mono, fontSize: 9.5, lineHeight: 1.25, color: 'var(--muted-foreground)', maxWidth: '100%', textAlign: 'center', overflowWrap: 'anywhere' } as const;

/** Every canonical icon, alphabetical. */
export const Gallery: Story = {
  parameters: { padW: 780 },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '14px 6px' }}>
      {ICON_NAMES.map((name) => (
        <div key={name} style={cell}>
          <Icon name={name} size={24} />
          <span style={label}>{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--primary)' }}>
      {[14, 18, 22, 28, 36, 48].map((s) => <Icon key={s} name="star" size={s} />)}
    </div>
  ),
};

function SearchGallery() {
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = ICON_NAMES.filter((n) => {
    const hay = `${n} ${ICON_KEYWORDS[n] ?? ''}`;
    return terms.every((t) => hay.includes(t));
  });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
        <Icon name="magnifyingglass" size={17} weight="semibold" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${ICON_NAMES.length} icons`} aria-label="Search icons"
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 15, color: 'var(--foreground)' }} />
      </label>
      <div style={{ ...mono, fontSize: 11, color: 'var(--muted-foreground)', minHeight: 14 }}>
        {copied ? `Copied <Icon name="${copied}" />` : `${hits.length} icons · click to copy`}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px 4px', maxHeight: 330, overflow: 'auto' }}>
        {hits.map((name) => (
          <button key={name} type="button" title={name}
            onClick={() => { void navigator.clipboard?.writeText(`<Icon name="${name}" />`).catch(() => {}); setCopied(name); }}
            style={{ ...cell, border: 0, background: 'transparent', padding: '6px 0', borderRadius: 8, cursor: 'pointer', font: 'inherit' }}>
            <Icon name={name} size={24} />
            <span style={label}>{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Filter by name or keyword (try "mute", "search", "lyrics"); click an icon to copy its JSX. */
export const Search: Story = { render: () => <SearchGallery /> };

const WEIGHT_ICONS = ['star', 'heart', 'bell', 'magnifyingglass', 'gear', 'check-circle', 'lock', 'paperplane'] as const;

/** Each weight maps to a stroke width; filled shapes stay the same. */
export const Weights: Story = {
  parameters: { padW: 460 },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Object.keys(ICON_WEIGHTS).length}, 1fr)`, gap: '12px 8px', color: 'var(--foreground)' }}>
      {(Object.keys(ICON_WEIGHTS) as IconWeight[]).map((w) => (
        <div key={w} style={{ ...label, textAlign: 'center' }}>{w}<br />{ICON_WEIGHTS[w]}</div>
      ))}
      {WEIGHT_ICONS.flatMap((name) =>
        (Object.keys(ICON_WEIGHTS) as IconWeight[]).map((w) => (
          <div key={name + w} style={{ display: 'grid', placeItems: 'center' }}><Icon name={name} weight={w} size={26} /></div>
        )),
      )}
    </div>
  ),
};

const CATEGORY_TITLES: Record<IconCategory, string> = {
  media: 'Media', security: 'Security', system: 'System', productivity: 'Productivity',
  communication: 'Communication', navigation: 'Navigation', status: 'Shapes & status',
};

/** The set grouped by use. Hover an icon for its name. */
export const Categories: Story = {
  parameters: { padW: 640 },
  render: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {(Object.keys(ICON_CATEGORIES) as IconCategory[]).map((cat) => (
        <section key={cat}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>
            {CATEGORY_TITLES[cat]} <span style={{ fontWeight: 400 }}>· {ICON_CATEGORIES[cat].length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 10, color: 'var(--foreground)' }}>
            {ICON_CATEGORIES[cat].map((name) => (
              <span key={name} title={name} style={{ display: 'grid', placeItems: 'center' }}><Icon name={name} size={22} /></span>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
